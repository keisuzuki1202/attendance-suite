import type { NextRequest } from "next/server";
import { authed, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, res } = await authed();
  if (!user) return res;
  const { id } = await ctx.params;
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== user.id) return fail("通知が見つかりません。", 404);
  await prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });
  return ok({ success: true });
}
