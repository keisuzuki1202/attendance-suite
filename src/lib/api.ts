import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "./auth";
import { prisma } from "./prisma";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ error: message, details: extra }, { status });
}

/** route handler 用: セッション取得。未認証なら null とレスポンスを返す。 */
export async function authed(): Promise<
  { user: SessionUser; res: null } | { user: null; res: NextResponse }
> {
  const user = await getSession();
  if (!user) {
    return { user: null, res: fail("認証が必要です。", 401) };
  }
  return { user, res: null };
}

/** 監査ログ記録 (要件8) */
export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeJson: input.before ? JSON.stringify(input.before) : null,
      afterJson: input.after ? JSON.stringify(input.after) : null,
      ipAddress: input.ipAddress ?? null,
    },
  });
}

/** 通知作成（アプリ内 + メール送信モック） */
export async function notify(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
  relatedApplicationId?: string;
}) {
  const n = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      relatedApplicationId: input.relatedApplicationId,
      channel: "in_app",
    },
  });
  // メール送信モック（MVP）: 実運用ではSMTP送信に差し替え
  await sendMailMock(input.userId, input.title, input.body);
  await prisma.notification.update({
    where: { id: n.id },
    data: { emailSentAt: new Date() },
  });
  return n;
}

async function sendMailMock(userId: string, subject: string, body: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  // 開発用: コンソール出力（SMTP/SESに差し替え可能）
  console.log(
    `[MAIL MOCK] to=${user?.email ?? userId} subject="${subject}" body="${body}"`,
  );
}

export function clientIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
