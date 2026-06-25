"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GenerateReport() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 既定: 前月
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: Number(year), month: Number(month) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "生成に失敗しました。" });
        return;
      }
      setMsg({ ok: true, text: `レポートを生成しました（対象 ${data.items} 名）。` });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "通信エラーが発生しました。" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold">レポート生成</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">対象年</label>
          <input type="number" className="input w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">対象月</label>
          <input type="number" min={1} max={12} className="input w-24" value={month} onChange={(e) => setMonth(Number(e.target.value))} />
        </div>
        <button className="btn btn-primary" disabled={loading} onClick={generate}>
          確定済み月次から生成
        </button>
      </div>
      {msg && (
        <p className="mt-2 text-sm" style={{ color: msg.ok ? "var(--success)" : "var(--error)" }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export function ShareButton({ reportId, shared }: { reportId: string; shared: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function share() {
    if (!confirm("このレポートを産業医へ共有しますか？")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/share`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (shared) return <span className="badge badge-success">共有済み</span>;
  return (
    <button className="btn btn-accent px-3 py-1 text-xs" disabled={loading} onClick={share}>
      産業医へ共有
    </button>
  );
}
