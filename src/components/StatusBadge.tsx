import {
  APPLICATION_STATUS_LABELS,
  STATUS_TONE,
} from "@/lib/constants";

const ATTENDANCE_LABELS: Record<string, string> = {
  unconfirmed: "要確認",
  needs_review: "要確認",
  normal: "正常",
  submitted: "提出済",
  locked: "ロック",
  open: "未確定",
  reopened: "再開",
  first_approved: "1次承認済",
  second_approved: "承認完了",
  pending: "未確認",
  shared: "共有済",
  physician_reviewed: "産業医確認済",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "muted";
  const label =
    APPLICATION_STATUS_LABELS[status] ?? ATTENDANCE_LABELS[status] ?? status;
  return <span className={`badge badge-${tone}`}>{label}</span>;
}
