import { prisma } from "./prisma";

export function monthRange(year: number, month1to12: number) {
  const start = new Date(year, month1to12 - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month1to12, 1, 0, 0, 0, 0);
  return { start, end };
}

export interface MonthlyAggregate {
  attendanceDays: number;
  totalWorkMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  holidayWorkDays: number;
}

export async function aggregateMonthly(
  userId: string,
  year: number,
  month1to12: number,
): Promise<MonthlyAggregate> {
  const { start, end } = monthRange(year, month1to12);
  const records = await prisma.attendanceRecord.findMany({
    where: { userId, workDate: { gte: start, lt: end } },
  });
  return records.reduce<MonthlyAggregate>(
    (acc, r) => {
      if (r.workMinutes > 0) acc.attendanceDays += 1;
      acc.totalWorkMinutes += r.workMinutes;
      acc.overtimeMinutes += r.overtimeMinutes;
      acc.nightMinutes += r.nightMinutes;
      if (r.isHolidayWork) acc.holidayWorkDays += 1;
      return acc;
    },
    {
      attendanceDays: 0,
      totalWorkMinutes: 0,
      overtimeMinutes: 0,
      nightMinutes: 0,
      holidayWorkDays: 0,
    },
  );
}

export async function paidLeaveRemaining(
  userId: string,
  fiscalYear: number,
): Promise<{ granted: number; used: number; remaining: number }> {
  const b = await prisma.paidLeaveBalance.findUnique({
    where: { userId_fiscalYear: { userId, fiscalYear } },
  });
  const granted = b?.grantedDays ?? 0;
  const used = b?.usedDays ?? 0;
  return { granted, used, remaining: granted - used };
}

/** ユーザーが今アクション可能な承認待ち申請 */
export async function pendingApprovalsFor(userId: string) {
  return prisma.application.findMany({
    where: {
      status: { in: ["submitted", "first_approved"] },
      approvalSteps: {
        some: {
          approverId: userId,
          decision: "pending",
        },
      },
      // 自分の申請は除外（内部統制）
      NOT: { applicantId: userId },
    },
    include: {
      applicant: { select: { name: true, employeeCode: true } },
      approvalSteps: true,
    },
    orderBy: { submittedAt: "asc" },
  });
}

/** 現在処理対象のステップがこのユーザーかどうか */
export function isUsersTurn(
  app: { currentStepLevel: number; approvalSteps: { stepLevel: number; approverId: string | null; decision: string }[] },
  userId: string,
): boolean {
  const step = app.approvalSteps.find((s) => s.stepLevel === app.currentStepLevel);
  return Boolean(step && step.approverId === userId && step.decision === "pending");
}

/**
 * 勤怠の表示用ステータスを導出する。
 * 打刻修正申請が進行中（申請中/1次承認済/差戻し）の場合は、その申請ステータスを優先表示する。
 * （承認完了で勤怠へ反映済みの場合・取消の場合は、勤怠レコード本来のステータスに戻す）
 */
export function deriveAttendanceStatus(
  recordStatus: string,
  corrections: { createdAt: Date; application: { status: string } }[],
): string {
  const active = [...corrections]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .find((c) => c.application.status !== "cancelled");
  if (!active) return recordStatus;
  // 承認完了 → 勤怠へ反映済み（record側が normal/locked）。本来の状態を表示。
  if (active.application.status === "second_approved") return recordStatus;
  // 申請中 / 1次承認済み / 1次差戻し / 2次差戻し を反映
  return active.application.status;
}

export async function unsubmittedAttendanceCount(
  userId: string,
  year: number,
  month1to12: number,
): Promise<number> {
  const { start, end } = monthRange(year, month1to12);
  return prisma.attendanceRecord.count({
    where: {
      userId,
      workDate: { gte: start, lt: end },
      status: { in: ["unconfirmed", "needs_review"] },
    },
  });
}
