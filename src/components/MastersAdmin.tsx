"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Item { id: string; code: string; name: string; isHoliday?: boolean }

function MasterSection({
  title,
  kind,
  items,
  withHoliday,
}: {
  title: string;
  kind: string;
  items: Item[];
  withHoliday?: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isHoliday, setIsHoliday] = useState(false);
  const [err, setErr] = useState("");

  async function add() {
    setErr("");
    const res = await fetch("/api/admin/masters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, code, name, isHoliday }),
    });
    if (res.ok) {
      setCode(""); setName(""); setIsHoliday(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "登録に失敗しました。");
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <ul className="mb-3 space-y-1 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2">
            <span className="badge badge-muted">{i.code}</span>
            <span>{i.name}</span>
            {i.isHoliday && <span className="badge badge-warning">休日扱い</span>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <div><label className="label">コード</label><input className="input w-28" value={code} onChange={(e) => setCode(e.target.value)} /></div>
        <div><label className="label">名称</label><input className="input w-40" value={name} onChange={(e) => setName(e.target.value)} /></div>
        {withHoliday && (
          <label className="flex items-center gap-1 pb-2 text-sm">
            <input type="checkbox" checked={isHoliday} onChange={(e) => setIsHoliday(e.target.checked)} /> 休日扱い
          </label>
        )}
        <button className="btn btn-primary" onClick={add}>追加</button>
      </div>
      {err && <p className="mt-2 text-sm" style={{ color: "var(--error)" }}>{err}</p>}
    </div>
  );
}

export function MastersAdmin({
  departments,
  employmentTypes,
  workTypes,
}: {
  departments: Item[];
  employmentTypes: Item[];
  workTypes: Item[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MasterSection title="所属部門" kind="department" items={departments} />
      <MasterSection title="雇用区分" kind="employment_type" items={employmentTypes} />
      <MasterSection title="勤務区分" kind="work_type" items={workTypes} withHoliday />
    </div>
  );
}
