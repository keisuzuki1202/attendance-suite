"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PhysicianItemActions({
  itemId,
  reviewed,
}: {
  itemId: string;
  reviewed: boolean;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(action: string, payload?: object) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/physician/items/${itemId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "処理に失敗しました。");
      setComment("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="no-print space-y-2 border-t pt-3">
      <textarea
        className="input"
        rows={2}
        placeholder="所見・コメントを入力"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="btn btn-outline" disabled={loading || !comment.trim()} onClick={() => run("comment", { body: comment })}>
          コメント登録
        </button>
        {!reviewed && (
          <button className="btn btn-success" disabled={loading} onClick={() => run("review")}>
            確認済みにする
          </button>
        )}
        {reviewed && <span className="badge badge-success self-center">確認済み</span>}
      </div>
      {error && <p className="text-sm" style={{ color: "var(--error)" }}>{error}</p>}
    </div>
  );
}
