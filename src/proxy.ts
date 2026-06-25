import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "kintai_session";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET ?? "dev-secret-change-me";
  return new TextEncoder().encode(s);
}

// 認証不要なパス
const PUBLIC_PATHS = ["/login"];
// 認証不要なAPI（エージェント等は別途APIキーで保護）
const PUBLIC_API = ["/api/auth/login", "/api/pc-logs"];

async function isAuthed(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = await isAuthed(req);

  // API
  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    if (!authed) {
      return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ログイン済みで /login に来たらダッシュボードへ
  if (PUBLIC_PATHS.includes(pathname)) {
    if (authed) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // それ以外のページは認証必須
  if (!authed) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // _next, 静的ファイル, assets を除く全て
    "/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.svg$|.*\\.png$).*)",
  ],
};
