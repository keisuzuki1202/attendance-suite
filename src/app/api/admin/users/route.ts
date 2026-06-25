import { z } from "zod";
import { authed, ok, fail, writeAudit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const createSchema = z.object({
  employeeCode: z.string().min(1).max(50),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8, "パスワードは8文字以上にしてください。"),
  role: z.enum(["employee", "first_approver", "second_approver", "admin", "occupational_physician"]),
  departmentId: z.string().optional().nullable(),
  employmentTypeId: z.string().optional().nullable(),
  firstApproverId: z.string().optional().nullable(),
  secondApproverId: z.string().optional().nullable(),
});

export async function GET() {
  const { user, res } = await authed();
  if (!user) return res;
  if (user.role !== "admin") return fail("管理者のみ実行できます。", 403);
  const users = await prisma.user.findMany({
    include: { department: true, employmentType: true },
    orderBy: { employeeCode: "asc" },
  });
  return ok({ users });
}

export async function POST(req: Request) {
  const { user, res } = await authed();
  if (!user) return res;
  if (user.role !== "admin") return fail("管理者のみ実行できます。", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("リクエスト本文が不正です。", 400);
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("入力値が不正です。", 422, parsed.error.flatten());
  const v = parsed.data;

  const dup = await prisma.user.findFirst({
    where: { OR: [{ email: v.email }, { employeeCode: v.employeeCode }] },
  });
  if (dup) return fail("メールアドレスまたは社員番号が既に使用されています。", 409);

  const created = await prisma.user.create({
    data: {
      employeeCode: v.employeeCode,
      email: v.email,
      name: v.name,
      passwordHash: await hashPassword(v.password),
      role: v.role,
      departmentId: v.departmentId || null,
      employmentTypeId: v.employmentTypeId || null,
      firstApproverId: v.firstApproverId || null,
      secondApproverId: v.secondApproverId || null,
    },
  });
  await writeAudit({
    actorId: user.id,
    action: "create",
    entityType: "User",
    entityId: created.id,
    after: { employeeCode: v.employeeCode, role: v.role },
  });
  return ok({ user: { id: created.id } }, 201);
}
