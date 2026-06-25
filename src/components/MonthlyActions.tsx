"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MonthlyActions({
  id,
  canSubmit,
  canApprove,
  canReopen,
}: {
  id: string;
  canSubmit: boolean;
  canApprove: boolean;
  canReopen: boolean;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(action: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/monthly/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "処理に失敗しました。");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!canSubmit && !canApprove && !canReopen) return null;

  return (
    <div className="no-print space-y-3">
      {canApprove && (
        <textarea
          className="input"
          rows={2}
          placeholder="承認コメント（任意）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {canSubmit && (
          <button className="btn btn-primary" disabled={loading} onClick={() => run("submit")}>
            月次勤怠を確定申請
          </button>
        )}
        {canApprove && (
          <button className="btn btn-success" disabled={loading} onClick={() => run("approve")}>
            電子承認
          </button>
        )}
        {canReopen && (
          <button
            className="btn btn-warning"
            disabled={loading}
            onClick={() => {
              if (confirm("確定済み月次を再オープンしますか？（管理者操作）")) run("reopen");
            }}
          >
            再オープン（修正許可）
          </button>
        )}
      </div>
      {error && <p className="text-sm" style={{ color: "var(--error)" }}>{error}</p>}
    </div>
  );
}
