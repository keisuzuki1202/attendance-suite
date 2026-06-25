import type { NextRequest } from "next/server";
import { authed, ok, fail } from "@/lib/api";
import {
  submitClosing,
  approveClosing,
  reopenClosing,
} from "@/lib/monthly";

const ACTIONS = ["submit", "approve", "reopen"] as const;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; action: string }> },
) {
  const { user, res } = await authed();
  if (!user) return res;
  const { id, action } = await ctx.params;
  if (!ACTIONS.includes(action as (typeof ACTIONS)[number]))
    return fail("不正なアクションです。", 404);

  let body: { comment?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    if (action === "submit") await submitClosing(id, user.id);
    else if (action === "approve")
      await approveClosing(id, { id: user.id, role: user.role }, body.comment);
    else if (action === "reopen")
      await reopenClosing(id, { id: user.id, role: user.role });
    return ok({ success: true });
  } catch (e) {
    const we = e as { code?: string; message?: string };
    const status =
      we.code === "FORBIDDEN" ? 403 : we.code === "NOT_FOUND" ? 404 : 409;
    return fail(we.message ?? "処理に失敗しました。", status);
  }
}
