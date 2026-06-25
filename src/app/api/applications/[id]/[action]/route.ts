import type { NextRequest } from "next/server";
import { authed, ok, fail } from "@/lib/api";
import {
  submitApplication,
  approveApplication,
  rejectApplication,
  cancelApplication,
  type WorkflowError,
} from "@/lib/workflow";

const ACTIONS = ["submit", "resubmit", "approve", "reject", "cancel"] as const;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; action: string }> },
) {
  const { user, res } = await authed();
  if (!user) return res;
  const { id, action } = await ctx.params;

  if (!ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    return fail("不正なアクションです。", 404);
  }

  let body: { comment?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    switch (action) {
      case "submit":
      case "resubmit":
        await submitApplication(id, user.id);
        break;
      case "approve":
        await approveApplication(id, { id: user.id, role: user.role }, body.comment);
        break;
      case "reject":
        if (!body.comment?.trim())
          return fail("差戻し理由（コメント）は必須です。", 422);
        await rejectApplication(id, { id: user.id, role: user.role }, body.comment);
        break;
      case "cancel":
        await cancelApplication(id, user.id);
        break;
    }
    return ok({ success: true });
  } catch (e) {
    const we = e as WorkflowError;
    const status =
      we.code === "FORBIDDEN"
        ? 403
        : we.code === "NOT_FOUND"
          ? 404
          : we.code === "VALIDATION"
            ? 422
            : 409;
    return fail(we.message ?? "処理に失敗しました。", status);
  }
}
