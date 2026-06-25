"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

async function callAction(id: string, action: string, comment?: string) {
  const res = await fetch(`/api/applications/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "処理に失敗しました。");
}

function useAction(id: string) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function run(action: string, comment?: string) {
    setLoading(true);
    setError("");
    try {
      await callAction(id, action, comment);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return { loading, error, run };
}

/** 当事者向け（取消・再申請） */
export function ApplicantActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const { loading, error, run } = useAction(id);
  const isDraft = status === "draft";
  const isRejected = status === "first_rejected" || status === "second_rejected";
  const canCancel = !["second_approved", "cancelled"].includes(status);
  if (!isDraft && !isRejected && !canCancel) return null;
  return (
    <div className="no-print">
      {isRejected && (
        <div
          className="mb-3 rounded-lg border px-4 py-3 text-sm"
          style={{ color: "var(--warning)", borderColor: "var(--warning)", background: "color-mix(in srgb, var(--warning) 8%, transparent)" }}
        >
          差戻しされた申請です。<strong>内容を編集してから再申請</strong>してください。
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {(isDraft || isRejected) && (
          <Link href={`/applications/${id}/edit`} className="btn btn-primary">
            {isRejected ? "編集して再申請" : "編集"}
          </Link>
        )}
        {isDraft && (
          <button className="btn btn-accent" disabled={loading} onClick={() => run("resubmit")}>
            そのまま提出
          </button>
        )}
        {canCancel && (
          <button className="btn btn-outline" disabled={loading} onClick={() => {
            if (confirm("この申請を取消しますか？")) run("cancel");
          }}>
            取消
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm" style={{ color: "var(--error)" }}>{error}</p>}
    </div>
  );
}

/** 承認者向け（承認・差戻し、コメント付き） */
export function ApproverActions({ id }: { id: string }) {
  const { loading, error, run } = useAction(id);
  const [comment, setComment] = useState("");
  const [mode, setMode] = useState<null | "reject">(null);

  return (
    <div className="no-print space-y-3">
      <textarea
        className="input"
        rows={2}
        placeholder="コメント（差戻し時は必須）"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-success"
          disabled={loading}
          onClick={() => run("approve", comment || undefined)}
        >
          承認
        </button>
        <button
          className="btn btn-warning"
          disabled={loading}
          onClick={() => {
            if (!comment.trim()) {
              setMode("reject");
              return;
            }
            run("reject", comment);
          }}
        >
          差戻し
        </button>
      </div>
      {mode === "reject" && !comment.trim() && (
        <p className="text-sm" style={{ color: "var(--warning)" }}>
          差戻しにはコメント（理由）の入力が必須です。
        </p>
      )}
      {error && <p className="text-sm" style={{ color: "var(--error)" }}>{error}</p>}
    </div>
  );
}
