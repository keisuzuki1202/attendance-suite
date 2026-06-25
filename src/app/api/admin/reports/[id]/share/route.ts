import type { NextRequest } from "next/server";
import { authed, ok, fail, writeAudit, notify } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// 産業医へ共有 (要件15.3 共有ワークフロー)
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, res } = await authed();
  if (!user) return res;
  if (user.role !== "admin") return fail("管理者のみ実行できます。", 403);
  const { id } = await ctx.params;

  const report = await prisma.occupationalHealthReport.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!report) return fail("レポートが見つかりません。", 404);

  await prisma.$transaction(async (tx) => {
    await tx.occupationalHealthReport.update({
      where: { id },
      data: { status: "shared", sharedAt: new Date() },
    });
    for (const item of report.items) {
      await tx.medicalReviewStatus.upsert({
        where: { reportItemId: item.id },
        update: { status: "shared" },
        create: { reportItemId: item.id, status: "shared" },
      });
    }
  });

  // 産業医へ通知
  const physicians = await prisma.user.findMany({
    where: { role: "occupational_physician", isActive: true },
    select: { id: true },
  });
  for (const p of physicians) {
    await notify({
      userId: p.id,
      type: "physician_shared",
      title: `産業医共有 (${report.year}/${report.month})`,
      body: "管理チームより月次勤務時間情報が共有されました。専用画面でご確認ください。",
      linkUrl: `/physician/reports/${report.id}`,
    });
  }

  await writeAudit({
    actorId: user.id,
    action: "physician_share",
    entityType: "OccupationalHealthReport",
    entityId: report.id,
    after: { status: "shared", items: report.items.length },
  });

  return ok({ success: true, notified: physicians.length });
}
