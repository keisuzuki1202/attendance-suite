import type { NextRequest } from "next/server";
import { z } from "zod";
import { authed, ok, fail, writeAudit } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  role: z.enum(["employee", "first_approver", "second_approver", "admin", "occupational_physician"]).optional(),
  departmentId: z.string().optional().nullable(),
  employmentTypeId: z.string().optional().nullable(),
  firstApproverId: z.string().optional().nullable(),
  secondApproverId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, res } = await authed();
  if (!user) return res;
  if (user.role !== "admin") return fail("管理者のみ実行できます。", 403);
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("リクエスト本文が不正です。", 400);
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("入力値が不正です。", 422, parsed.error.flatten());

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return fail("ユーザーが見つかりません。", 404);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      role: parsed.data.role ?? undefined,
      departmentId: parsed.data.departmentId === undefined ? undefined : parsed.data.departmentId || null,
      employmentTypeId: parsed.data.employmentTypeId === undefined ? undefined : parsed.data.employmentTypeId || null,
      firstApproverId: parsed.data.firstApproverId === undefined ? undefined : parsed.data.firstApproverId || null,
      secondApproverId: parsed.data.secondApproverId === undefined ? undefined : parsed.data.secondApproverId || null,
      isActive: parsed.data.isActive ?? undefined,
    },
  });
  await writeAudit({
    actorId: user.id,
    action: "update",
    entityType: "User",
    entityId: id,
    before: { role: before.role, isActive: before.isActive },
    after: { role: updated.role, isActive: updated.isActive },
  });
  return ok({ success: true });
}
