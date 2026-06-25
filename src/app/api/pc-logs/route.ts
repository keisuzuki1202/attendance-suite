import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, writeAudit, clientIp } from "@/lib/api";
import { calcAttendance, dateOnly, isLateStart } from "@/lib/attendance";

// PC起動/終了ログ受信エンドポイント（要件3.1 / 11）
// 常駐エージェント/タスクスケジューラ/PowerShellから呼び出す。APIキーで保護。

const schema = z.object({
  employeeCode: z.string().optional(),
  userId: z.string().optional(),
  terminalId: z.string().min(1),
  eventType: z.enum(["startup", "shutdown", "logon", "logoff"]),
  occurredAt: z.string(),
  ipAddress: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  // APIキー検証
  const key = req.headers.get("x-api-key");
  const expected = process.env.PC_AGENT_API_KEY ?? "dev-pc-agent-key-change-me";
  if (!key || key !== expected) {
    return fail("APIキーが不正です。", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("リクエスト本文が不正です。", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("入力値が不正です。", 422, parsed.error.flatten());
  }
  const v = parsed.data;

  // ユーザー解決
  const user = v.userId
    ? await prisma.user.findUnique({ where: { id: v.userId } })
    : v.employeeCode
      ? await prisma.user.findUnique({ where: { employeeCode: v.employeeCode } })
      : null;
  if (!user) return fail("対象ユーザーが見つかりません。", 404);

  const occurredAt = new Date(v.occurredAt);
  if (isNaN(occurredAt.getTime())) return fail("発生時刻が不正です。", 422);
  const ip = v.ipAddress ?? clientIp(req);

  // 1) 監査証跡として PC ログを追記（改ざん不可・更新削除しない）
  const log = await prisma.pcActivityLog.create({
    data: {
      userId: user.id,
      terminalId: v.terminalId,
      eventType: v.eventType,
      occurredAt,
      ipAddress: ip,
      rawPayload: JSON.stringify(v),
    },
  });

  // 2) 勤怠レコードへ自動反映（startup→開始, shutdown/logoff→終了）
  const workDate = dateOnly(occurredAt);
  const existing = await prisma.attendanceRecord.findUnique({
    where: { userId_workDate: { userId: user.id, workDate } },
  });

  const isStart = v.eventType === "startup" || v.eventType === "logon";
  let clockIn = existing?.clockIn ?? null;
  let clockOut = existing?.clockOut ?? null;
  const breakMinutes = existing?.breakMinutes ?? 60;

  if (isStart) {
    // 最も早い起動を開始時刻とする
    if (!clockIn || occurredAt < clockIn) clockIn = occurredAt;
  } else {
    // 最も遅い終了を終了時刻とする
    if (!clockOut || occurredAt > clockOut) clockOut = occurredAt;
  }

  const calc = calcAttendance({ clockIn, clockOut, breakMinutes });
  // 両方そろっていても、09:00より後の出勤打刻は要確認（打刻修正が必要）
  const status =
    clockIn && clockOut
      ? isLateStart(clockIn)
        ? "needs_review"
        : "normal"
      : "unconfirmed";

  if (existing) {
    if (!existing.locked) {
      await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: { clockIn, clockOut, breakMinutes, source: "auto", status, ...calc },
      });
    }
  } else {
    await prisma.attendanceRecord.create({
      data: {
        userId: user.id,
        workDate,
        clockIn,
        clockOut,
        breakMinutes,
        source: "auto",
        status,
        ...calc,
      },
    });
  }

  await writeAudit({
    actorId: user.id,
    action: "pc_log",
    entityType: "PcActivityLog",
    entityId: log.id,
    after: { eventType: v.eventType, occurredAt: v.occurredAt, terminalId: v.terminalId },
    ipAddress: ip,
  });

  return ok({ success: true, logId: log.id, attendanceStatus: status }, 201);
}
