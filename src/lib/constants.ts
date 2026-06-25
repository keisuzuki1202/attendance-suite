// ドメイン共通の列挙値・ラベル（SQLiteはenum非対応のため文字列で統一管理）

export const ROLES = {
  employee: "employee",
  first_approver: "first_approver",
  second_approver: "second_approver",
  admin: "admin",
  occupational_physician: "occupational_physician",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  employee: "従業員",
  first_approver: "1次承認者",
  second_approver: "2次承認者",
  admin: "管理者",
  occupational_physician: "産業医",
};

export const APPLICATION_TYPES = {
  paid_leave: "paid_leave",
  training: "training",
  business_trip: "business_trip",
  correction: "correction",
} as const;
export type ApplicationType =
  (typeof APPLICATION_TYPES)[keyof typeof APPLICATION_TYPES];

export const APPLICATION_TYPE_LABELS: Record<string, string> = {
  paid_leave: "有給休暇",
  training: "研修",
  business_trip: "出張",
  correction: "打刻修正",
};

// 出張区分
export const TRIP_TYPE_LABELS: Record<string, string> = {
  domestic: "国内出張",
  overseas: "海外出張",
};

// 申請ステータス
export const APPLICATION_STATUS = {
  draft: "draft",
  submitted: "submitted",
  first_approved: "first_approved",
  second_approved: "second_approved",
  first_rejected: "first_rejected",
  second_rejected: "second_rejected",
  cancelled: "cancelled",
  rejected: "rejected",
} as const;
export type ApplicationStatus =
  (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  submitted: "申請中",
  first_approved: "1次承認済み",
  second_approved: "承認完了",
  first_rejected: "1次差戻し",
  second_rejected: "2次差戻し",
  cancelled: "取消済み",
  rejected: "却下",
};

// ステータスバッジの色トークン（globals.css の semantic クラスに対応）
export const STATUS_TONE: Record<string, "success" | "info" | "warning" | "error" | "muted"> = {
  draft: "muted",
  submitted: "info",
  first_approved: "info",
  second_approved: "success",
  first_rejected: "warning",
  second_rejected: "warning",
  cancelled: "muted",
  rejected: "error",
  // 勤怠
  unconfirmed: "warning",
  needs_review: "warning",
  normal: "success",
  locked: "muted",
  // 月次
  open: "muted",
  reopened: "warning",
  // 産業医
  pending: "muted",
  shared: "info",
  physician_reviewed: "success",
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  application_received: "申請受付",
  approval_request: "承認依頼",
  first_approved: "1次承認完了",
  second_approved: "2次承認完了",
  rejected: "差戻し",
  resubmitted: "再申請",
  monthly_unsubmitted: "月次勤怠未提出",
  long_work_alert: "長時間労働アラート",
  physician_shared: "産業医共有完了",
};

export const ALERT_TYPE_LABELS: Record<string, string> = {
  over45: "月45時間超過",
  over80: "月80時間超過",
  consecutive_long: "連続長時間労働",
  night_increase: "深夜勤務増加",
  holiday_increase: "休日勤務増加",
  low_paid_leave: "有給取得率低下",
  month_unconfirmed: "月次勤怠未確定",
  approval_delay: "承認遅延",
};

// 36協定しきい値（分）
export const OVERTIME_WARN_MINUTES = 45 * 60; // 45h
export const OVERTIME_CRITICAL_MINUTES = 80 * 60; // 80h

// 深夜帯（22:00-翌5:00）
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 5;

// 所定労働（分）
export const STANDARD_WORK_MINUTES = 8 * 60;

// 所定勤務時間 09:00 〜 17:30
// ・17:30 以降の労働は時間外労働としてカウント
// ・09:00 より後に勤務開始が打刻された場合は打刻修正が必要（要確認）
export const SCHEDULED_START_HOUR = 9;
export const SCHEDULED_START_MINUTE = 0;
export const SCHEDULED_END_HOUR = 17;
export const SCHEDULED_END_MINUTE = 30;
