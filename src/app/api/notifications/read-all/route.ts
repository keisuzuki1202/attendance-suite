import { authed, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const { user, res } = await authed();
  if (!user) return res;
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return ok({ success: true });
}
