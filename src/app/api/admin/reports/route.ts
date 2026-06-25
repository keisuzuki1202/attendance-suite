import { z } from "zod";
import { authed, ok, fail, writeAudit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { OVERTIME_WARN_MINUTES, OVERTIME_CRITICAL_MINUTES } from "@/lib/constants";

const schema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  note: z.string().max(1000).optional().nullable(),
});

// 産業医共有レポートを月次確定データから自動生成 (要件15.3)
export async function POST(req: Request) {
  const { user, res } = await authed();
  if (!user) return res;
  if (user.role !== "admin") return fail("管理者のみ実行できます。", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("リクエスト本文が不正です。", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("入力値が不正です。", 422, parsed.error.flatten());
  const { year, month, note } = parsed.data;

  // 確定済み（2次承認）月次のみ対象
  const closings = await prisma.monthlyAttendanceClosing.findMany({
    where: { year, month, status: "second_approved" },
    include: { user: { select: { departmentId: true } } },
  });
  if (closings.length === 0) {
    return fail("対象となる確定済み月次勤怠がありません。先に月次承認を完了してください。", 409);
  }

  const report = await prisma.occupationalHealthReport.upsert({
    where: { year_month: { year, month } },
    update: { generatedById: user.id, generatedAt: new Date(), note: note ?? null },
    create: { year, month, generatedById: user.id, status: "draft", note: note ?? null },
  });

  for (const c of closings) {
    const over45 = c.overtimeMinutes > OVERTIME_WARN_MINUTES;
    const over80 = c.overtimeMinutes > OVERTIME_CRITICAL_MINUTES;
    const interviewCandidate = over45; // 45h超で面談候補
    const item = await prisma.occupationalHealthReportItem.upsert({
      where: { reportId_userId: { reportId: report.id, userId: c.userId } },
      update: {
        departmentId: c.user.departmentId,
        totalWorkMinutes: c.totalWorkMinutes,
        overtimeMinutes: c.overtimeMinutes,
        nightMinutes: c.nightMinutes,
        holidayWorkDays: c.holidayWorkDays,
        paidLeaveDays: c.paidLeaveDays,
        over45,
        over80,
        interviewCandidate,
      },
      create: {
        reportId: report.id,
        userId: c.userId,
        departmentId: c.user.departmentId,
        totalWorkMinutes: c.totalWorkMinutes,
        overtimeMinutes: c.overtimeMinutes,
        nightMinutes: c.nightMinutes,
        holidayWorkDays: c.holidayWorkDays,
        paidLeaveDays: c.paidLeaveDays,
        over45,
        over80,
        interviewCandidate,
      },
    });
    await prisma.medicalReviewStatus.upsert({
      where: { reportItemId: item.id },
      update: {},
      create: { reportItemId: item.id, status: "pending" },
    });
  }

  await writeAudit({
    actorId: user.id,
    action: "generate_report",
    entityType: "OccupationalHealthReport",
    entityId: report.id,
    after: { year, month, items: closings.length },
  });

  return ok({ report, items: closings.length }, 201);
}
