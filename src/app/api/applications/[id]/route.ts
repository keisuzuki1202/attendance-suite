import type { NextRequest } from "next/server";
import { authed, ok, fail, writeAudit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { applicationCreateSchema, toDate } from "@/lib/validation";

const EDITABLE = ["draft", "first_rejected", "second_rejected"];

// 申請内容の編集（下書き・差戻し案件のみ）。再申請の前にこのAPIで内容を更新する。
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, res } = await authed();
  if (!user) return res;
  const { id } = await ctx.params;

  const app = await prisma.application.findUnique({
    where: { id },
    include: { correctionRequest: true },
  });
  if (!app) return fail("申請が見つかりません。", 404);
  if (app.applicantId !== user.id) return fail("本人のみ編集できます。", 403);
  if (!EDITABLE.includes(app.status))
    return fail("この状態では編集できません（下書き・差戻しのみ）。", 409);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("リクエスト本文が不正です。", 400);
  }
  const parsed = applicationCreateSchema.safeParse(body);
  if (!parsed.success) return fail("入力値が不正です。", 422, parsed.error.flatten());
  const v = parsed.data;

  await prisma.application.update({
    where: { id },
    data: {
      title: v.title,
      content: v.content,
      expectedEffect: v.expectedEffect || null,
      targetStartAt: toDate(v.targetStartAt),
      targetEndAt: toDate(v.targetEndAt),
      comment: v.comment || null,
      attachmentPath: v.attachmentPath || null,
      tripType:
        app.applicationType === "business_trip" ? v.tripType ?? "domestic" : null,
    },
  });

  // 打刻修正の詳細も更新
  if (app.applicationType === "correction" && app.correctionRequest) {
    await prisma.correctionRequest.update({
      where: { id: app.correctionRequest.id },
      data: {
        afterClockIn: toDate(v.afterClockIn),
        afterClockOut: toDate(v.afterClockOut),
        afterBreakMinutes: v.afterBreakMinutes ?? null,
        afterWorkTypeId: v.afterWorkTypeId || null,
        reason: v.reason ?? app.correctionRequest.reason,
      },
    });
  }

  await writeAudit({
    actorId: user.id,
    action: "update",
    entityType: "Application",
    entityId: id,
    after: { title: v.title },
  });

  return ok({ success: true });
}
