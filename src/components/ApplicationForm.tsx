"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { APPLICATION_TYPE_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/attendance";

interface AttendanceOption {
  id: string;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
}
interface WorkTypeOption {
  id: string;
  name: string;
}

export interface ApplicationFormValues {
  title: string;
  content: string;
  expectedEffect: string;
  targetStartAt: string;
  targetEndAt: string;
  comment: string;
  attachmentPath: string;
  tripType: string;
  attendanceRecordId: string;
  afterClockIn: string;
  afterClockOut: string;
  afterBreakMinutes: number;
  afterWorkTypeId: string;
  reason: string;
}

export function ApplicationForm({
  type,
  attendanceOptions = [],
  workTypes = [],
  editId,
  status,
  initialValues,
}: {
  type: string;
  attendanceOptions?: AttendanceOption[];
  workTypes?: WorkTypeOption[];
  editId?: string;
  status?: string;
  initialValues?: Partial<ApplicationFormValues>;
}) {
  const router = useRouter();
  const isCorrection = type === "correction";
  const isTrip = type === "business_trip";
  const isEdit = Boolean(editId);
  const isRejected =
    status === "first_rejected" || status === "second_rejected";
  const label = APPLICATION_TYPE_LABELS[type] ?? "申請";

  const [form, setForm] = useState<ApplicationFormValues>({
    title: `${label}申請`,
    content: "",
    expectedEffect: "",
    targetStartAt: "",
    targetEndAt: "",
    comment: "",
    attachmentPath: "",
    tripType: "domestic",
    attendanceRecordId: "",
    afterClockIn: "",
    afterClockOut: "",
    afterBreakMinutes: 60,
    afterWorkTypeId: "",
    reason: "",
    ...initialValues,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: val }));
  }

  async function save(submit: boolean) {
    setLoading(true);
    setServerError("");
    setErrors({});
    try {
      const payload = {
        applicationType: type,
        title: form.title,
        content: form.content,
        expectedEffect: form.expectedEffect,
        targetStartAt: form.targetStartAt || null,
        targetEndAt: form.targetEndAt || null,
        comment: form.comment || null,
        attachmentPath: form.attachmentPath || null,
        tripType: isTrip ? form.tripType : null,
        submit,
        attendanceRecordId: form.attendanceRecordId || null,
        afterClockIn: form.afterClockIn || null,
        afterClockOut: form.afterClockOut || null,
        afterBreakMinutes: Number(form.afterBreakMinutes),
        afterWorkTypeId: form.afterWorkTypeId || null,
        reason: form.reason || null,
      };
      if (isEdit && editId) {
        // 編集（下書き・差戻し）: PATCH で内容を更新してから必要に応じて再申請
        const res = await fetch(`/api/applications/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.details?.fieldErrors) setErrors(data.details.fieldErrors);
          setServerError(data.error ?? "保存に失敗しました。");
          return;
        }
        if (submit) {
          const sres = await fetch(`/api/applications/${editId}/resubmit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const sdata = await sres.json().catch(() => ({}));
          if (!sres.ok) {
            setServerError(sdata.error ?? "再申請に失敗しました。");
            return;
          }
        }
        router.push(`/applications/${editId}`);
        router.refresh();
        return;
      }

      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.details?.fieldErrors) setErrors(data.details.fieldErrors);
        setServerError(data.error ?? "保存に失敗しました。");
        return;
      }
      router.push(`/applications/${data.application.id}`);
      router.refresh();
    } catch {
      setServerError("通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  const fieldErr = (k: string) =>
    errors[k]?.[0] ? (
      <p className="mt-1 text-xs" style={{ color: "var(--error)" }}>
        {errors[k][0]}
      </p>
    ) : null;

  return (
    <div className="card max-w-2xl p-6">
      {serverError && (
        <div
          className="mb-4 rounded-lg border px-3 py-2 text-sm"
          style={{ color: "var(--error)", borderColor: "var(--error)" }}
        >
          {serverError}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">タイトル</label>
          <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} />
          {fieldErr("title")}
        </div>

        {isCorrection ? (
          <>
            <div>
              <label className="label">修正対象の勤怠 *</label>
              <select
                className="input"
                value={form.attendanceRecordId}
                onChange={(e) => {
                  const opt = attendanceOptions.find((o) => o.id === e.target.value);
                  set("attendanceRecordId", e.target.value);
                  if (opt) {
                    set("afterClockIn", opt.clockIn?.slice(0, 16) ?? "");
                    set("afterClockOut", opt.clockOut?.slice(0, 16) ?? "");
                    set("afterBreakMinutes", opt.breakMinutes);
                  }
                }}
              >
                <option value="">選択してください</option>
                {attendanceOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {fmtDate(new Date(o.workDate))}
                  </option>
                ))}
              </select>
              {fieldErr("attendanceRecordId")}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">修正後 出勤</label>
                <input type="datetime-local" className="input" value={form.afterClockIn} onChange={(e) => set("afterClockIn", e.target.value)} />
              </div>
              <div>
                <label className="label">修正後 退勤</label>
                <input type="datetime-local" className="input" value={form.afterClockOut} onChange={(e) => set("afterClockOut", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">休憩（分）</label>
                <input type="number" className="input" value={form.afterBreakMinutes} onChange={(e) => set("afterBreakMinutes", Number(e.target.value))} />
              </div>
              <div>
                <label className="label">勤務区分</label>
                <select className="input" value={form.afterWorkTypeId} onChange={(e) => set("afterWorkTypeId", e.target.value)}>
                  <option value="">変更なし</option>
                  {workTypes.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">修正理由 *</label>
              <textarea className="input" rows={3} value={form.reason} onChange={(e) => set("reason", e.target.value)} />
              {fieldErr("reason")}
            </div>
          </>
        ) : (
          <>
            {isTrip && (
              <div>
                <label className="label">出張区分 *</label>
                <select
                  className="input"
                  value={form.tripType}
                  onChange={(e) => set("tripType", e.target.value)}
                >
                  <option value="domestic">国内出張</option>
                  <option value="overseas">海外出張</option>
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">該当日時（開始）*</label>
                <input type="datetime-local" className="input" value={form.targetStartAt} onChange={(e) => set("targetStartAt", e.target.value)} />
                {fieldErr("targetStartAt")}
              </div>
              <div>
                <label className="label">該当日時（終了）</label>
                <input type="datetime-local" className="input" value={form.targetEndAt} onChange={(e) => set("targetEndAt", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">予測効果 *</label>
              <textarea className="input" rows={2} value={form.expectedEffect} onChange={(e) => set("expectedEffect", e.target.value)} />
              {fieldErr("expectedEffect")}
            </div>
          </>
        )}

        <div>
          <label className="label">内容 *</label>
          <textarea className="input" rows={3} value={form.content} onChange={(e) => set("content", e.target.value)} />
          {fieldErr("content")}
        </div>
        <div>
          <label className="label">添付資料（パス/URL・任意）</label>
          <input className="input" value={form.attachmentPath} onChange={(e) => set("attachmentPath", e.target.value)} placeholder="例: shared/出張稟議.pdf" />
        </div>
        <div>
          <label className="label">コメント（任意）</label>
          <textarea className="input" rows={2} value={form.comment} onChange={(e) => set("comment", e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button className="btn btn-outline" disabled={loading} onClick={() => save(false)}>
            {isEdit ? "内容を保存" : "下書き保存"}
          </button>
          <button className="btn btn-primary" disabled={loading} onClick={() => save(true)}>
            {loading
              ? "送信中..."
              : isEdit
                ? isRejected
                  ? "保存して再申請"
                  : "保存して提出"
                : "申請する"}
          </button>
        </div>
      </div>
    </div>
  );
}
