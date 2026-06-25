"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_LABELS } from "@/lib/constants";

interface Opt { id: string; name: string }
interface UserRow {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
  employmentTypeId: string | null;
  firstApproverId: string | null;
  secondApproverId: string | null;
  isActive: boolean;
}

const ROLES = ["employee", "first_approver", "second_approver", "admin", "occupational_physician"];

export function UsersAdmin({
  users,
  departments,
  employmentTypes,
}: {
  users: UserRow[];
  departments: Opt[];
  employmentTypes: Opt[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState("");
  const approverOptions = users;

  async function patch(id: string, data: object) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setMsg("更新しました。");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? "更新に失敗しました。");
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "閉じる" : "＋ 新規従業員"}
        </button>
        {msg && <span className="text-sm text-[var(--text-muted)]">{msg}</span>}
      </div>

      {showCreate && (
        <CreateForm departments={departments} employmentTypes={employmentTypes} approvers={approverOptions} onDone={() => { setShowCreate(false); router.refresh(); }} />
      )}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>社員番号</th><th>氏名</th><th>ロール</th><th>部門</th>
              <th>1次承認者</th><th>2次承認者</th><th>状態</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.employeeCode}</td>
                <td>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{u.email}</div>
                </td>
                <td>
                  <select className="input py-1" defaultValue={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td>
                  <select className="input py-1" defaultValue={u.departmentId ?? ""} onChange={(e) => patch(u.id, { departmentId: e.target.value })}>
                    <option value="">—</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </td>
                <td>
                  <select className="input py-1" defaultValue={u.firstApproverId ?? ""} onChange={(e) => patch(u.id, { firstApproverId: e.target.value })}>
                    <option value="">—</option>
                    {approverOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </td>
                <td>
                  <select className="input py-1" defaultValue={u.secondApproverId ?? ""} onChange={(e) => patch(u.id, { secondApproverId: e.target.value })}>
                    <option value="">—</option>
                    {approverOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </td>
                <td>
                  <button
                    className={`badge ${u.isActive ? "badge-success" : "badge-muted"}`}
                    onClick={() => patch(u.id, { isActive: !u.isActive })}
                  >
                    {u.isActive ? "有効" : "無効"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateForm({
  departments,
  employmentTypes,
  approvers,
  onDone,
}: {
  departments: Opt[];
  employmentTypes: Opt[];
  approvers: Opt[];
  onDone: () => void;
}) {
  const [f, setF] = useState({
    employeeCode: "", email: "", name: "", password: "", role: "employee",
    departmentId: "", employmentTypeId: "", firstApproverId: "", secondApproverId: "",
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? "登録に失敗しました。"); return; }
      onDone();
    } finally { setLoading(false); }
  }

  return (
    <div className="card mb-4 p-5">
      {err && <p className="mb-2 text-sm" style={{ color: "var(--error)" }}>{err}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className="label">社員番号</label><input className="input" value={f.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} /></div>
        <div><label className="label">氏名</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label className="label">メール</label><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div><label className="label">初期パスワード</label><input className="input" value={f.password} onChange={(e) => set("password", e.target.value)} /></div>
        <div><label className="label">ロール</label>
          <select className="input" value={f.role} onChange={(e) => set("role", e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div><label className="label">部門</label>
          <select className="input" value={f.departmentId} onChange={(e) => set("departmentId", e.target.value)}>
            <option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div><label className="label">雇用区分</label>
          <select className="input" value={f.employmentTypeId} onChange={(e) => set("employmentTypeId", e.target.value)}>
            <option value="">—</option>{employmentTypes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div><label className="label">1次承認者</label>
          <select className="input" value={f.firstApproverId} onChange={(e) => set("firstApproverId", e.target.value)}>
            <option value="">—</option>{approvers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div><label className="label">2次承認者</label>
          <select className="input" value={f.secondApproverId} onChange={(e) => set("secondApproverId", e.target.value)}>
            <option value="">—</option>{approvers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-4">
        <button className="btn btn-primary" disabled={loading} onClick={submit}>登録</button>
      </div>
    </div>
  );
}
