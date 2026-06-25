// 権限設計 (要件7 / 15.3 産業医ロール)
// 各ロールごとに 閲覧/申請/承認/差戻し/修正/管理者設定/産業医閲覧 を分離。

export type Permission =
  | "view" // 自分の勤怠・申請の閲覧
  | "apply" // 申請（有給/研修/出張/打刻修正）
  | "approve" // 承認（=差戻しも含む承認アクション権）
  | "reject" // 差戻し
  | "edit_attendance" // 勤怠の直接修正（承認済みは不可）
  | "admin_settings" // 管理者設定・マスタ管理
  | "manage_team" // 管理チームダッシュボード・月次・産業医共有
  | "physician_view"; // 産業医閲覧

const MATRIX: Record<string, Permission[]> = {
  employee: ["view", "apply", "edit_attendance"],
  first_approver: ["view", "apply", "approve", "reject", "edit_attendance"],
  second_approver: ["view", "apply", "approve", "reject", "edit_attendance"],
  admin: [
    "view",
    "apply",
    "approve",
    "reject",
    "edit_attendance",
    "admin_settings",
    "manage_team",
  ],
  occupational_physician: ["physician_view"],
};

export function can(role: string, perm: Permission): boolean {
  return MATRIX[role]?.includes(perm) ?? false;
}

export function isAdmin(role: string): boolean {
  return role === "admin";
}

export function isApprover(role: string): boolean {
  return (
    role === "first_approver" || role === "second_approver" || role === "admin"
  );
}

export function isPhysician(role: string): boolean {
  return role === "occupational_physician";
}

/**
 * 内部統制: 承認者本人が自分の申請を承認できない (要件8)。
 */
export function canActOnApplication(opts: {
  actorId: string;
  applicantId: string;
  role: string;
}): boolean {
  if (!isApprover(opts.role)) return false;
  if (opts.actorId === opts.applicantId) return false;
  return true;
}
