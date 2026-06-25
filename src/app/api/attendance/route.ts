import { z } from "zod";
import { authed, ok, fail, writeAudit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { calcAttendance, dateOnly, isLateStart } from "@/lib/attendance";
import { toDate } from "@/lib/validation";

const schema = z.object({
  workDate: z.string().min(1),
  clockIn: z.string().optional().nullable(),
  clockOut: z.string().optional().nullable(),
  breakMinutes: z.number().int().min(0).max(1440).default(60),
  workTypeId: z.string().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  const { user, res } = await authed();
  if (!user) return res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("リクエスト本文が不正です。", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("入力値が不正です。", 422, parsed.error.flatten());
  const v = parsed.data;

  const wd = toDate(v.workDate);
  if (!wd) return fail("対象日が不正です。", 422);
  const workDate = dateOnly(wd);

  const clockIn = toDate(v.clockIn);
  const clockOut = toDate(v.clockOut);
  if (clockIn && clockOut && clockOut <= clockIn) {
    return fail("退勤時刻は出勤時刻より後にしてください。", 422);
  }

  let isHoliday = false;
  if (v.workTypeId) {
    const wt = await prisma.workType.findUnique({ where: { id: v.workTypeId } });
    isHoliday = wt?.isHoliday ?? false;
  }

  const existing = await prisma.attendanceRecord.findUnique({
    where: { userId_workDate: { userId: user.id, workDate } },
  });

  // 内部統制: 確定済み(ロック)勤怠は直接編集不可（打刻修正申請が必要）
  if (existing?.locked) {
    return fail("確定済み勤怠は直接編集できません。打刻修正申請を行ってください。", 409);
  }

  const calc = calcAttendance({ clockIn, clockOut, breakMinutes: v.breakMinutes, isHoliday });
  // 09:00より後の出勤打刻は要確認（打刻修正が必要）
  const status =
    clockIn && clockOut
      ? isLateStart(clockIn)
        ? "needs_review"
        : "normal"
      : "unconfirmed";

  const saved = await prisma.attendanceRecord.upsert({
    where: { userId_workDate: { userId: user.id, workDate } },
    update: {
      clockIn,
      clockOut,
      breakMinutes: v.breakMinutes,
      workTypeId: v.workTypeId || null,
      note: v.note || null,
      source: "manual",
      status,
      ...calc,
    },
    create: {
      userId: user.id,
      workDate,
      clockIn,
      clockOut,
      breakMinutes: v.breakMinutes,
      workTypeId: v.workTypeId || null,
      note: v.note || null,
      source: "manual",
      status,
      ...calc,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: existing ? "update" : "create",
    entityType: "AttendanceRecord",
    entityId: saved.id,
    before: existing
      ? { clockIn: existing.clockIn, clockOut: existing.clockOut, breakMinutes: existing.breakMinutes }
      : undefined,
    after: { clockIn, clockOut, breakMinutes: v.breakMinutes },
  });

  return ok({ attendance: saved });
}
