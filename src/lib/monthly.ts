// 月次勤怠確定 + 2階層電子承認（押印代替の証跡） 要件15.3
import { prisma } from "./prisma";
import { writeAudit, notify } from "./api";
import { aggregateMonthly, monthRange } from "./queries";
import { canActOnApplication } from "./rbac";
import {
  OVERTIME_WARN_MINUTES,
  OVERTIME_CRITICAL_MINUTES,
} from "./constants";

function err(code: string, message: string) {
  return { code, message };
}

/** 集計値を再計算して closing に反映 */
export async function recomputeClosing(closingId: string) {
  const c = await prisma.monthlyAttendanceClosing.findUnique({ where: { id: closingId } });
  if (!c) return;
  const agg = await aggregateMonthly(c.userId, c.year, c.month);
  // 有給取得日数（当月に承認完了した有給申請数を概算）
  const { start, end } = monthRange(c.year, c.month);
  const paid = await prisma.application.count({
    where: {
      applicantId: c.userId,
      applicationType: "paid_leave",
      status: "second_approved",
      targetStartAt: { gte: start, lt: end },
    },
  });
  await prisma.monthlyAttendanceClosing.update({
    where: { id: closingId },
    data: {
      attendanceDays: agg.attendanceDays,
      totalWorkMinutes: agg.totalWorkMinutes,
      overtimeMinutes: agg.overtimeMinutes,
      nightMinutes: agg.nightMinutes,
      holidayWorkDays: agg.holidayWorkDays,
      paidLeaveDays: paid,
    },
  });
}

/** 月次勤怠を確定申請（従業員） */
export async function submitClosing(closingId: string, actorId: string) {
  const c = await prisma.monthlyAttendanceClosing.findUnique({ where: { id: closingId } });
  if (!c) throw err("NOT_FOUND", "月次勤怠が見つかりません。");
  if (c.userId !== actorId) throw err("FORBIDDEN", "本人のみ確定申請できます。");
  if (!["open", "reopened"].includes(c.status))
    throw err("INVALID_STATE", "この状態では確定申請できません。");

  const user = await prisma.user.findUnique({
    where: { id: c.userId },
    select: { firstApproverId: true, secondApproverId: true },
  });
  if (!user?.firstApproverId || !user?.secondApproverId)
    throw err("NO_APPROVER", "承認者が設定されていません。");

  await recomputeClosing(closingId);
  await prisma.$transaction(async (tx) => {
    await tx.monthlyApprovalLog.deleteMany({ where: { closingId } });
    await tx.monthlyApprovalLog.createMany({
      data: [
        { closingId, stepLevel: 1, approverId: user.firstApproverId, decision: "pending" },
        { closingId, stepLevel: 2, approverId: user.secondApproverId, decision: "pending" },
      ],
    });
    await tx.monthlyAttendanceClosing.update({
      where: { id: closingId },
      data: {
        status: "submitted",
        firstApproverId: user.firstApproverId,
        secondApproverId: user.secondApproverId,
        submittedAt: new Date(),
      },
    });
  });

  await notify({
    userId: user.firstApproverId,
    type: "approval_request",
    title: `月次勤怠 承認依頼 (${c.year}/${c.month})`,
    body: "月次勤怠の確定承認をお願いします。",
    linkUrl: `/monthly/${closingId}`,
  });
  await writeAudit({
    actorId,
    action: "submit",
    entityType: "MonthlyAttendanceClosing",
    entityId: closingId,
    after: { status: "submitted" },
  });
}

/** 月次勤怠を電子承認（1次/2次） */
export async function approveClosing(
  closingId: string,
  actor: { id: string; role: string },
  comment?: string,
) {
  const c = await prisma.monthlyAttendanceClosing.findUnique({
    where: { id: closingId },
    include: { approvalLogs: true },
  });
  if (!c) throw err("NOT_FOUND", "月次勤怠が見つかりません。");
  if (!canActOnApplication({ actorId: actor.id, applicantId: c.userId, role: actor.role }))
    throw err("FORBIDDEN", "承認権限がありません（本人は不可）。");

  const level = c.status === "submitted" ? 1 : c.status === "first_approved" ? 2 : 0;
  if (level === 0) throw err("INVALID_STATE", "この状態では承認できません。");
  const step = c.approvalLogs.find((s) => s.stepLevel === level);
  if (!step || step.approverId !== actor.id)
    throw err("FORBIDDEN", "現在の承認順序の担当者ではありません。");

  const isFinal = level === 2;
  await prisma.$transaction(async (tx) => {
    await tx.monthlyApprovalLog.update({
      where: { id: step.id },
      data: { decision: "approved", comment, decidedAt: new Date() },
    });
    await tx.monthlyAttendanceClosing.update({
      where: { id: closingId },
      data: isFinal
        ? { status: "second_approved", locked: true, lockedAt: new Date() }
        : { status: "first_approved" },
    });
    if (isFinal) {
      // 承認後ロック: 当月の勤怠レコードをロック (要件15.3)
      const { start, end } = monthRange(c.year, c.month);
      await tx.attendanceRecord.updateMany({
        where: { userId: c.userId, workDate: { gte: start, lt: end } },
        data: { locked: true, status: "locked" },
      });
    }
  });

  if (isFinal) {
    await generateAlertsForClosing(closingId);
    await notify({
      userId: c.userId,
      type: "second_approved",
      title: `月次勤怠 承認完了 (${c.year}/${c.month})`,
      body: "月次勤怠が承認完了しロックされました。",
      linkUrl: `/monthly/${closingId}`,
    });
    // 管理チーム(admin)へ通知（産業医共有検討のため）
    const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
    for (const a of admins) {
      await notify({
        userId: a.id,
        type: "second_approved",
        title: `月次勤怠 確定 (${c.year}/${c.month})`,
        body: "2次承認が完了しました。産業医共有対象をご確認ください。",
        linkUrl: "/admin",
      });
    }
  } else if (c.secondApproverId) {
    await notify({
      userId: c.secondApproverId,
      type: "approval_request",
      title: `月次勤怠 承認依頼 (${c.year}/${c.month})`,
      body: "1次承認が完了しました。2次承認をお願いします。",
      linkUrl: `/monthly/${closingId}`,
    });
  }

  await writeAudit({
    actorId: actor.id,
    action: "approve",
    entityType: "MonthlyAttendanceClosing",
    entityId: closingId,
    after: { level, status: isFinal ? "second_approved" : "first_approved" },
  });
}

/** 確定後の修正のため管理者が再オープン（管理者承認付き修正） 要件15.3 */
export async function reopenClosing(closingId: string, actor: { id: string; role: string }) {
  if (actor.role !== "admin") throw err("FORBIDDEN", "管理者のみ再オープンできます。");
  const c = await prisma.monthlyAttendanceClosing.findUnique({ where: { id: closingId } });
  if (!c) throw err("NOT_FOUND", "月次勤怠が見つかりません。");
  const { start, end } = monthRange(c.year, c.month);
  await prisma.$transaction(async (tx) => {
    await tx.monthlyAttendanceClosing.update({
      where: { id: closingId },
      data: { status: "reopened", locked: false, lockedAt: null },
    });
    await tx.attendanceRecord.updateMany({
      where: { userId: c.userId, workDate: { gte: start, lt: end } },
      data: { locked: false, status: "normal" },
    });
  });
  await writeAudit({
    actorId: actor.id,
    action: "reopen",
    entityType: "MonthlyAttendanceClosing",
    entityId: closingId,
    after: { status: "reopened" },
  });
}

/** 長時間労働アラートを生成 (要件15.4) */
async function generateAlertsForClosing(closingId: string) {
  const c = await prisma.monthlyAttendanceClosing.findUnique({ where: { id: closingId } });
  if (!c) return;
  const checks: { type: string; severity: string; cond: boolean; msg: string }[] = [
    {
      type: "over80",
      severity: "critical",
      cond: c.overtimeMinutes > OVERTIME_CRITICAL_MINUTES,
      msg: `月80時間を超える時間外労働が発生しています（${Math.round(c.overtimeMinutes / 60)}時間）。`,
    },
    {
      type: "over45",
      severity: "warning",
      cond:
        c.overtimeMinutes > OVERTIME_WARN_MINUTES &&
        c.overtimeMinutes <= OVERTIME_CRITICAL_MINUTES,
      msg: `月45時間を超える時間外労働が発生しています（${Math.round(c.overtimeMinutes / 60)}時間）。`,
    },
    {
      type: "night_increase",
      severity: "info",
      cond: c.nightMinutes >= 10 * 60,
      msg: "深夜勤務が増加しています。",
    },
    {
      type: "holiday_increase",
      severity: "info",
      cond: c.holidayWorkDays >= 2,
      msg: "休日勤務が増加しています。",
    },
  ];
  for (const ck of checks) {
    if (!ck.cond) continue;
    const exists = await prisma.laborRiskAlert.findFirst({
      where: { userId: c.userId, alertType: ck.type, year: c.year, month: c.month },
    });
    if (exists) continue;
    await prisma.laborRiskAlert.create({
      data: {
        userId: c.userId,
        alertType: ck.type,
        severity: ck.severity,
        year: c.year,
        month: c.month,
        message: ck.msg,
      },
    });
  }
}
