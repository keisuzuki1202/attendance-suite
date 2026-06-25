// 2階層承認ワークフローのドメインロジック（状態機械）
// 状態遷移の整合性を一元管理する (要件3.4 / 3.5 / 13)。

import { prisma } from "./prisma";
import { writeAudit, notify } from "./api";
import { canActOnApplication } from "./rbac";
import { calcAttendance } from "./attendance";
import { APPLICATION_TYPE_LABELS } from "./constants";

export type WorkflowError = { code: string; message: string };

function err(code: string, message: string): WorkflowError {
  return { code, message };
}

const REJECTED = ["first_rejected", "second_rejected"];

/** 申請を提出（draft/差戻し → submitted）。承認者をレポートラインから自動設定。 */
export async function submitApplication(applicationId: string, actorId: string) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { approvalSteps: true },
  });
  if (!app) throw err("NOT_FOUND", "申請が見つかりません。");
  if (app.applicantId !== actorId)
    throw err("FORBIDDEN", "本人のみ提出できます。");
  if (!["draft", ...REJECTED].includes(app.status))
    throw err("INVALID_STATE", "この状態では提出できません。");

  const applicant = await prisma.user.findUnique({
    where: { id: app.applicantId },
    select: { firstApproverId: true, secondApproverId: true },
  });
  if (!applicant?.firstApproverId || !applicant?.secondApproverId) {
    throw err(
      "NO_APPROVER",
      "承認者（1次/2次）が設定されていません。管理者にお問い合わせください。",
    );
  }

  const isResubmit = REJECTED.includes(app.status);

  await prisma.$transaction(async (tx) => {
    // ステップを初期化（既存があれば作り直す）
    await tx.applicationApprovalStep.deleteMany({ where: { applicationId } });
    await tx.applicationApprovalStep.createMany({
      data: [
        { applicationId, stepLevel: 1, approverId: applicant.firstApproverId, decision: "pending" },
        { applicationId, stepLevel: 2, approverId: applicant.secondApproverId, decision: "pending" },
      ],
    });
    await tx.application.update({
      where: { id: applicationId },
      data: {
        status: "submitted",
        currentStepLevel: 1,
        firstApproverId: applicant.firstApproverId,
        secondApproverId: applicant.secondApproverId,
        submittedAt: new Date(),
        completedAt: null,
        resubmitCount: isResubmit ? app.resubmitCount + 1 : app.resubmitCount,
      },
    });
    if (isResubmit) {
      await tx.approvalComment.create({
        data: { applicationId, authorId: actorId, body: "再申請しました。", kind: "resubmit" },
      });
    }
  });

  // 通知: 1次承認者へ承認依頼、（再申請時）当事者控え
  await notify({
    userId: applicant.firstApproverId,
    type: "approval_request",
    title: `承認依頼: ${app.title}`,
    body: `${APPLICATION_TYPE_LABELS[app.applicationType]}の申請が${isResubmit ? "再" : ""}提出されました。`,
    linkUrl: `/approvals/${applicationId}`,
    relatedApplicationId: applicationId,
  });
  await writeAudit({
    actorId,
    action: isResubmit ? "resubmit" : "submit",
    entityType: "Application",
    entityId: applicationId,
    after: { status: "submitted" },
  });
}

/** 承認アクション（1次/2次）。 */
export async function approveApplication(
  applicationId: string,
  actor: { id: string; role: string },
  comment?: string,
) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { approvalSteps: true },
  });
  if (!app) throw err("NOT_FOUND", "申請が見つかりません。");
  if (!canActOnApplication({ actorId: actor.id, applicantId: app.applicantId, role: actor.role }))
    throw err("FORBIDDEN", "この申請を承認する権限がありません（本人申請は不可）。");
  if (!["submitted", "first_approved"].includes(app.status))
    throw err("INVALID_STATE", "この状態では承認できません。");

  const step = app.approvalSteps.find((s) => s.stepLevel === app.currentStepLevel);
  if (!step) throw err("INVALID_STATE", "承認ステップが不正です。");
  if (step.approverId !== actor.id)
    throw err("FORBIDDEN", "現在の承認順序の担当者ではありません。");
  if (step.decision !== "pending")
    throw err("INVALID_STATE", "既に処理済みです。");

  const isFinal = app.currentStepLevel === 2;

  await prisma.$transaction(async (tx) => {
    await tx.applicationApprovalStep.update({
      where: { id: step.id },
      data: { decision: "approved", comment, decidedAt: new Date() },
    });
    await tx.approvalComment.create({
      data: { applicationId, authorId: actor.id, body: comment ?? "承認しました。", kind: "approve" },
    });
    await tx.application.update({
      where: { id: applicationId },
      data: isFinal
        ? { status: "second_approved", currentStepLevel: 0, completedAt: new Date() }
        : { status: "first_approved", currentStepLevel: 2 },
    });
  });

  if (isFinal) {
    await applyCompletionSideEffects(applicationId);
    // 完了通知: 1次承認者 + 当事者
    if (app.firstApproverId) {
      await notify({
        userId: app.firstApproverId,
        type: "second_approved",
        title: `承認完了: ${app.title}`,
        body: "2次承認が完了しました。",
        linkUrl: `/applications/${applicationId}`,
        relatedApplicationId: applicationId,
      });
    }
    await notify({
      userId: app.applicantId,
      type: "second_approved",
      title: `承認完了: ${app.title}`,
      body: "申請が承認完了しました。",
      linkUrl: `/applications/${applicationId}`,
      relatedApplicationId: applicationId,
    });
  } else {
    // 1次承認完了通知: 2次承認者 + 当事者
    if (app.secondApproverId) {
      await notify({
        userId: app.secondApproverId,
        type: "approval_request",
        title: `承認依頼: ${app.title}`,
        body: "1次承認が完了しました。2次承認をお願いします。",
        linkUrl: `/approvals/${applicationId}`,
        relatedApplicationId: applicationId,
      });
    }
    await notify({
      userId: app.applicantId,
      type: "first_approved",
      title: `1次承認完了: ${app.title}`,
      body: "1次承認が完了しました。2次承認待ちです。",
      linkUrl: `/applications/${applicationId}`,
      relatedApplicationId: applicationId,
    });
  }

  await writeAudit({
    actorId: actor.id,
    action: "approve",
    entityType: "Application",
    entityId: applicationId,
    after: { stepLevel: app.currentStepLevel, status: isFinal ? "second_approved" : "first_approved" },
  });
}

/** 差戻し（1次/2次）。 */
export async function rejectApplication(
  applicationId: string,
  actor: { id: string; role: string },
  comment: string,
) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { approvalSteps: true },
  });
  if (!app) throw err("NOT_FOUND", "申請が見つかりません。");
  if (!comment?.trim())
    throw err("VALIDATION", "差戻し理由（コメント）は必須です。");
  if (!canActOnApplication({ actorId: actor.id, applicantId: app.applicantId, role: actor.role }))
    throw err("FORBIDDEN", "この申請を差戻す権限がありません。");
  if (!["submitted", "first_approved"].includes(app.status))
    throw err("INVALID_STATE", "この状態では差戻しできません。");

  const step = app.approvalSteps.find((s) => s.stepLevel === app.currentStepLevel);
  if (!step || step.approverId !== actor.id)
    throw err("FORBIDDEN", "現在の承認順序の担当者ではありません。");

  const isSecond = app.currentStepLevel === 2;
  const newStatus = isSecond ? "second_rejected" : "first_rejected";

  await prisma.$transaction(async (tx) => {
    await tx.applicationApprovalStep.update({
      where: { id: step.id },
      data: { decision: "rejected", comment, decidedAt: new Date() },
    });
    await tx.approvalComment.create({
      data: { applicationId, authorId: actor.id, body: comment, kind: "reject" },
    });
    await tx.application.update({
      where: { id: applicationId },
      data: { status: newStatus },
    });
  });

  // 差戻し通知: 当事者へ。2次差戻しは1次承認者にも。
  await notify({
    userId: app.applicantId,
    type: "rejected",
    title: `差戻し: ${app.title}`,
    body: `${isSecond ? "2次" : "1次"}承認者より差戻されました。内容を確認し再申請してください。`,
    linkUrl: `/applications/${applicationId}`,
    relatedApplicationId: applicationId,
  });
  if (isSecond && app.firstApproverId) {
    await notify({
      userId: app.firstApproverId,
      type: "rejected",
      title: `差戻し: ${app.title}`,
      body: "2次承認者より差戻されました。",
      linkUrl: `/applications/${applicationId}`,
      relatedApplicationId: applicationId,
    });
  }

  await writeAudit({
    actorId: actor.id,
    action: "reject",
    entityType: "Application",
    entityId: applicationId,
    after: { status: newStatus },
  });
}

/** 取消（当事者）。 */
export async function cancelApplication(applicationId: string, actorId: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw err("NOT_FOUND", "申請が見つかりません。");
  if (app.applicantId !== actorId)
    throw err("FORBIDDEN", "本人のみ取消できます。");
  if (["second_approved", "cancelled"].includes(app.status))
    throw err("INVALID_STATE", "この申請は取消できません。");

  await prisma.application.update({
    where: { id: applicationId },
    data: { status: "cancelled", currentStepLevel: 0 },
  });
  await writeAudit({
    actorId,
    action: "cancel",
    entityType: "Application",
    entityId: applicationId,
    after: { status: "cancelled" },
  });
}

/** 承認完了時の副作用（有給消化・打刻修正の反映）。 */
async function applyCompletionSideEffects(applicationId: string) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { correctionRequest: true },
  });
  if (!app) return;

  if (app.applicationType === "paid_leave") {
    // 取得日数を概算（開始・終了日の差+1、最低1日）
    let days = 1;
    if (app.targetStartAt && app.targetEndAt) {
      const diff =
        Math.round(
          (new Date(app.targetEndAt).setHours(0, 0, 0, 0) -
            new Date(app.targetStartAt).setHours(0, 0, 0, 0)) /
            86400000,
        ) + 1;
      days = Math.max(1, diff);
    }
    const fiscalYear = (app.targetStartAt ?? new Date()).getFullYear();
    await prisma.paidLeaveBalance.upsert({
      where: { userId_fiscalYear: { userId: app.applicantId, fiscalYear } },
      update: { usedDays: { increment: days } },
      create: { userId: app.applicantId, fiscalYear, grantedDays: 0, usedDays: days },
    });
  }

  if (app.applicationType === "correction" && app.correctionRequest) {
    const cr = app.correctionRequest;
    const rec = await prisma.attendanceRecord.findUnique({
      where: { id: cr.attendanceRecordId },
    });
    if (rec && !rec.locked) {
      const clockIn = cr.afterClockIn ?? rec.clockIn;
      const clockOut = cr.afterClockOut ?? rec.clockOut;
      const breakMinutes = cr.afterBreakMinutes ?? rec.breakMinutes;
      const workTypeId = cr.afterWorkTypeId ?? rec.workTypeId;
      let isHoliday = rec.isHolidayWork;
      if (workTypeId) {
        const wt = await prisma.workType.findUnique({ where: { id: workTypeId } });
        isHoliday = wt?.isHoliday ?? isHoliday;
      }
      const calc = calcAttendance({ clockIn, clockOut, breakMinutes, isHoliday });
      await prisma.attendanceRecord.update({
        where: { id: rec.id },
        data: {
          clockIn,
          clockOut,
          breakMinutes,
          workTypeId,
          source: "manual",
          status: "normal",
          ...calc,
        },
      });
      await writeAudit({
        actorId: app.applicantId,
        action: "update",
        entityType: "AttendanceRecord",
        entityId: rec.id,
        before: { clockIn: rec.clockIn, clockOut: rec.clockOut, breakMinutes: rec.breakMinutes },
        after: { clockIn, clockOut, breakMinutes },
      });
    }
  }
}
