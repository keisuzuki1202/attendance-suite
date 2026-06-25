import { CheckCircle2, XCircle, Clock, Paperclip } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { APPLICATION_TYPE_LABELS, TRIP_TYPE_LABELS } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/attendance";

interface Step {
  stepLevel: number;
  decision: string;
  comment: string | null;
  decidedAt: Date | null;
  approver: { name: string } | null;
}
interface Comment {
  body: string;
  kind: string;
  createdAt: Date;
  author: { name: string };
}
interface Correction {
  beforeClockIn: Date | null;
  afterClockIn: Date | null;
  beforeClockOut: Date | null;
  afterClockOut: Date | null;
  beforeBreakMinutes: number | null;
  afterBreakMinutes: number | null;
  reason: string;
  attendanceRecord: { workDate: Date } | null;
}
export interface AppDetail {
  id: string;
  applicationType: string;
  title: string;
  status: string;
  content: string;
  expectedEffect: string | null;
  comment: string | null;
  attachmentPath: string | null;
  tripType: string | null;
  targetStartAt: Date | null;
  targetEndAt: Date | null;
  submittedAt: Date | null;
  resubmitCount: number;
  applicant: { name: string; employeeCode: string };
  approvalSteps: Step[];
  approvalComments: Comment[];
  correctionRequest: Correction | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2">
      <div className="text-sm font-medium text-[var(--text-muted)]">{label}</div>
      <div className="col-span-2 text-sm">{children}</div>
    </div>
  );
}

function StepIcon({ decision }: { decision: string }) {
  if (decision === "approved")
    return <CheckCircle2 size={18} style={{ color: "var(--success)" }} />;
  if (decision === "rejected")
    return <XCircle size={18} style={{ color: "var(--warning)" }} />;
  return <Clock size={18} style={{ color: "var(--text-muted)" }} />;
}

export function ApplicationDetailView({ app }: { app: AppDetail }) {
  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="badge badge-info mr-2">
              {APPLICATION_TYPE_LABELS[app.applicationType]}
            </span>
            <span className="text-lg font-bold">{app.title}</span>
          </div>
          <StatusBadge status={app.status} />
        </div>

        <div className="divide-y">
          <Row label="申請者">
            {app.applicant.name}（{app.applicant.employeeCode}）
          </Row>
          {app.applicationType === "business_trip" && app.tripType && (
            <Row label="出張区分">
              <span className="badge badge-info">
                {TRIP_TYPE_LABELS[app.tripType] ?? app.tripType}
              </span>
            </Row>
          )}
          {app.targetStartAt && (
            <Row label="期間">
              {fmtDate(app.targetStartAt)}
              {app.targetEndAt && ` 〜 ${fmtDate(app.targetEndAt)}`}
            </Row>
          )}
          <Row label="内容">{app.content}</Row>
          {app.expectedEffect && <Row label="期待効果">{app.expectedEffect}</Row>}
          {app.attachmentPath && (
            <Row label="添付資料">
              <span className="inline-flex items-center gap-1">
                <Paperclip size={14} /> {app.attachmentPath}
              </span>
            </Row>
          )}
          {app.comment && <Row label="コメント">{app.comment}</Row>}
          <Row label="提出日時">
            {app.submittedAt ? fmtDate(app.submittedAt) : "未提出"}
            {app.resubmitCount > 0 && `（再申請 ${app.resubmitCount} 回）`}
          </Row>
        </div>

        {app.correctionRequest && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold">打刻修正内容</h3>
            <table className="table-base">
              <thead>
                <tr>
                  <th>項目</th>
                  <th>修正前</th>
                  <th>修正後</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>出勤</td>
                  <td>{fmtTime(app.correctionRequest.beforeClockIn)}</td>
                  <td className="font-semibold" style={{ color: "var(--accent)" }}>
                    {fmtTime(app.correctionRequest.afterClockIn)}
                  </td>
                </tr>
                <tr>
                  <td>退勤</td>
                  <td>{fmtTime(app.correctionRequest.beforeClockOut)}</td>
                  <td className="font-semibold" style={{ color: "var(--accent)" }}>
                    {fmtTime(app.correctionRequest.afterClockOut)}
                  </td>
                </tr>
                <tr>
                  <td>休憩（分）</td>
                  <td>{app.correctionRequest.beforeBreakMinutes ?? "—"}</td>
                  <td className="font-semibold" style={{ color: "var(--accent)" }}>
                    {app.correctionRequest.afterBreakMinutes ?? "—"}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-sm">
              <span className="font-medium text-[var(--text-muted)]">理由: </span>
              {app.correctionRequest.reason}
            </p>
          </div>
        )}
      </div>

      {/* 承認フロー */}
      <div className="card p-6">
        <h3 className="mb-3 font-semibold">承認フロー（2階層）</h3>
        <div className="space-y-3">
          {app.approvalSteps
            .sort((a, b) => a.stepLevel - b.stepLevel)
            .map((s) => (
              <div key={s.stepLevel} className="flex items-start gap-3">
                <StepIcon decision={s.decision} />
                <div>
                  <div className="text-sm font-medium">
                    {s.stepLevel}次承認: {s.approver?.name ?? "未設定"}
                    <span className="ml-2 text-xs text-[var(--text-muted)]">
                      {s.decision === "approved"
                        ? "承認済"
                        : s.decision === "rejected"
                          ? "差戻し"
                          : "承認待ち"}
                      {s.decidedAt && ` ・ ${fmtDate(s.decidedAt)}`}
                    </span>
                  </div>
                  {s.comment && (
                    <div className="text-sm text-[var(--text-muted)]">{s.comment}</div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* コメント履歴 */}
      {app.approvalComments.length > 0 && (
        <div className="card p-6">
          <h3 className="mb-3 font-semibold">履歴・コメント</h3>
          <div className="space-y-3">
            {app.approvalComments.map((c, i) => (
              <div key={i} className="border-l-2 pl-3" style={{ borderColor: "var(--accent)" }}>
                <div className="text-sm">{c.body}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {c.author.name} ・ {fmtDate(c.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
