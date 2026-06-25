import type { NextRequest } from "next/server";
import { authed, ok, fail, writeAudit, notify } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// 産業医のコメント入力・確認済みステータス更新 (要件15.3)
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; action: string }> },
) {
  const { user, res } = await authed();
  if (!user) return res;
  if (user.role !== "occupational_physician")
    return fail("産業医のみ実行できます。", 403);
  const { id, action } = await ctx.params;

  const item = await prisma.occupationalHealthReportItem.findUnique({
    where: { id },
    include: { reviewStatus: true, report: true, user: { select: { name: true } } },
  });
  if (!item) return fail("対象が見つかりません。", 404);
  if (item.report.status !== "shared")
    return fail("共有されていないため操作できません。", 409);

  let body: { body?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (action === "comment") {
    if (!body.body?.trim()) return fail("コメントを入力してください。", 422);
    await prisma.occupationalPhysicianComment.create({
      data: { reportItemId: id, physicianId: user.id, body: body.body },
    });
    await writeAudit({
      actorId: user.id,
      action: "physician_comment",
      entityType: "OccupationalHealthReportItem",
      entityId: id,
    });
    return ok({ success: true });
  }

  if (action === "review") {
    await prisma.medicalReviewStatus.upsert({
      where: { reportItemId: id },
      update: { status: "physician_reviewed", reviewedByPhysicianId: user.id, reviewedAt: new Date() },
      create: { reportItemId: id, status: "physician_reviewed", reviewedByPhysicianId: user.id, reviewedAt: new Date() },
    });
    // 管理チームへ確認完了通知
    const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
    for (const a of admins) {
      await notify({
        userId: a.id,
        type: "physician_shared",
        title: "産業医確認完了",
        body: `${item.user.name} さんの勤務情報を産業医が確認しました。`,
        linkUrl: "/admin/physician-share",
      });
    }
    await writeAudit({
      actorId: user.id,
      action: "physician_review",
      entityType: "OccupationalHealthReportItem",
      entityId: id,
      after: { status: "physician_reviewed" },
    });
    return ok({ success: true });
  }

  return fail("不正なアクションです。", 404);
}
