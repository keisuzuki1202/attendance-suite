import { z } from "zod";
import { login } from "@/lib/auth";
import { ok, fail, writeAudit, clientIp } from "@/lib/api";

const schema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません。"),
  password: z.string().min(1, "パスワードを入力してください。"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("リクエスト本文が不正です。", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("入力値が不正です。", 422, parsed.error.flatten());
  }
  const result = await login(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return fail(result.error, 401);
  }
  await writeAudit({
    actorId: result.user.id,
    action: "login",
    entityType: "User",
    entityId: result.user.id,
    ipAddress: clientIp(req),
  });
  return ok({ user: result.user });
}
