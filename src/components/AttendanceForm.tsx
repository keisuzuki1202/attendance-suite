"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface WT {
  id: string;
  name: string;
}

export function AttendanceForm({
  workTypes,
  initial,
}: {
  workTypes: WT[];
  initial: {
    workDate: string;
    clockIn: string;
    clockOut: string;
    breakMinutes: number;
    workTypeId: string;
    note: string;
    locked: boolean;
    source: string;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: val }));
  }

  async function save() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workDate: form.workDate,
          clockIn: form.clockIn || null,
          clockOut: form.clockOut || null,
          breakMinutes: Number(form.breakMinutes),
          workTypeId: form.workTypeId || null,
          note: form.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "保存に失敗しました。" });
        return;
      }
      setMsg({ ok: true, text: "勤怠を保存しました。" });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "通信エラーが発生しました。" });
    } finally {
      setLoading(false);
    }
  }

  if (form.locked) {
    return (
      <div className="card p-6">
        <p className="text-sm" style={{ color: "var(--warning)" }}>
          この日の勤怠は確定済み（ロック）のため直接編集できません。
          修正が必要な場合は「打刻修正」から申請してください。
        </p>
      </div>
    );
  }

  return (
    <div className="card max-w-2xl p-6">
      {msg && (
        <div
          className="mb-4 rounded-lg border px-3 py-2 text-sm"
          style={{ color: msg.ok ? "var(--success)" : "var(--error)", borderColor: msg.ok ? "var(--success)" : "var(--error)" }}
        >
          {msg.text}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">対象日</label>
          <input type="date" className="input" value={form.workDate} onChange={(e) => set("workDate", e.target.value)} />
        </div>
        <div>
          <label className="label">勤務区分</label>
          <select className="input" value={form.workTypeId} onChange={(e) => set("workTypeId", e.target.value)}>
            <option value="">未選択</option>
            {workTypes.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">出勤時刻</label>
          <input type="datetime-local" className="input" value={form.clockIn} onChange={(e) => set("clockIn", e.target.value)} />
        </div>
        <div>
          <label className="label">退勤時刻</label>
          <input type="datetime-local" className="input" value={form.clockOut} onChange={(e) => set("clockOut", e.target.value)} />
        </div>
        <div>
          <label className="label">休憩（分）</label>
          <input type="number" className="input" value={form.breakMinutes} onChange={(e) => set("breakMinutes", Number(e.target.value))} />
        </div>
        <div>
          <label className="label">備考</label>
          <input className="input" value={form.note} onChange={(e) => set("note", e.target.value)} />
        </div>
      </div>
      <div className="mt-2 text-xs text-[var(--text-muted)]">
        現在の登録ソース: {form.source === "auto" ? "PC自動打刻" : "手動入力"}
      </div>
      <div className="mt-4">
        <button className="btn btn-primary" disabled={loading} onClick={save}>
          {loading ? "保存中..." : "勤怠を保存"}
        </button>
      </div>
    </div>
  );
}
