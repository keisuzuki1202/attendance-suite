import { authed, ok, fail, writeAudit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { applicationCreateSchema, toDate } from "@/lib/validation";
import { submitApplication } from "@/lib/workflow";
import { APPLICATION_TYPE_LABELS } from "@/lib/constants";

export async function GET() {
  const { user, res } = await authed();
  if (!user) return res;
  const apps = await prisma.application.findMany({
    where: { applicantId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { approvalSteps: true },
  });
  return ok({ applications: apps });
}

export async function POST(req: Request) {
  const { user, res } = await authed();
  if (!user) return res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("リクエスト本文が不正です。", 400);
  }
  const parsed = applicationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("入力値が不正です。", 422, parsed.error.flatten());
  }
  const v = parsed.data;

  // 打刻修正は対象勤怠の所有者チェック・ロックチェック
  if (v.applicationType === "correction") {
    const rec = await prisma.attendanceRecord.findUnique({
      where: { id: v.attendanceRecordId! },
    });
    if (!rec || rec.userId !== user.id) {
      return fail("対象の勤怠が見つかりません。", 404);
    }
    if (rec.locked) {
      return fail("確定済み（ロック）勤怠は修正申請できません。", 409);
    }
  }

  const created = await prisma.application.create({
    data: {
      applicationType: v.applicationType,
      applicantId: user.id,
      title: v.title,
      content: v.content,
      expectedEffect: v.expectedEffect || null,
      targetStartAt: toDate(v.targetStartAt),
      targetEndAt: toDate(v.targetEndAt),
      comment: v.comment || null,
      attachmentPath: v.attachmentPath || null,
      tripType: v.applicationType === "business_trip" ? v.tripType ?? "domestic" : null,
      status: "draft",
      currentStepLevel: 0,
      ...(v.applicationType === "correction"
        ? {
            correctionRequest: {
              create: {
                attendanceRecordId: v.attendanceRecordId!,
                applicantId: user.id,
                afterClockIn: toDate(v.afterClockIn),
                afterClockOut: toDate(v.afterClockOut),
                afterBreakMinutes: v.afterBreakMinutes ?? null,
                afterWorkTypeId: v.afterWorkTypeId || null,
                reason: v.reason!,
              },
            },
          }
        : {}),
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "create",
    entityType: "Application",
    entityId: created.id,
    after: { type: v.applicationType, title: v.title },
  });

  // 打刻修正で修正前の値をスナップショット保存
  if (v.applicationType === "correction") {
    const rec = await prisma.attendanceRecord.findUnique({
      where: { id: v.attendanceRecordId! },
    });
    if (rec) {
      await prisma.correctionRequest.updateMany({
        where: { applicationId: created.id },
        data: {
          beforeClockIn: rec.clockIn,
          beforeClockOut: rec.clockOut,
          beforeBreakMinutes: rec.breakMinutes,
          beforeWorkTypeId: rec.workTypeId,
        },
      });
    }
  }

  if (v.submit) {
    try {
      await submitApplication(created.id, user.id);
    } catch (e) {
      const we = e as { message?: string };
      return ok(
        {
          application: created,
          warning: `下書きとして保存しましたが提出に失敗しました: ${we.message ?? ""}`,
        },
        201,
      );
    }
  }

  return ok(
    { application: created, label: APPLICATION_TYPE_LABELS[v.applicationType] },
    201,
  );
}
