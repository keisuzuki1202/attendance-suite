import { z } from "zod";
import { authed, ok, fail, writeAudit } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  kind: z.enum(["department", "employment_type", "work_type"]),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  isHoliday: z.boolean().optional().default(false),
});

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
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("入力値が不正です。", 422, parsed.error.flatten());
  const { kind, code, name, isHoliday } = parsed.data;

  try {
    let id: string;
    if (kind === "department") {
      id = (await prisma.department.create({ data: { code, name } })).id;
    } else if (kind === "employment_type") {
      id = (await prisma.employmentType.create({ data: { code, name } })).id;
    } else {
      id = (await prisma.workType.create({ data: { code, name, isHoliday } })).id;
    }
    await writeAudit({ actorId: user.id, action: "create", entityType: kind, entityId: id, after: { code, name } });
    return ok({ id }, 201);
  } catch {
    return fail("コードが重複している可能性があります。", 409);
  }
}
