import Link from "next/link";
import {
  Clock,
  Timer,
  CalendarDays,
  FileWarning,
  CheckSquare,
  AlertTriangle,
  Users,
  Stethoscope,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  aggregateMonthly,
  paidLeaveRemaining,
  pendingApprovalsFor,
  unsubmittedAttendanceCount,
} from "@/lib/queries";
import { PageHeader, StatCard, SectionCard, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { minutesToHHMM, fmtTime, fmtDate, dateOnly } from "@/lib/attendance";
import { APPLICATION_TYPE_LABELS } from "@/lib/constants";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "occupational_physician") redirect("/physician");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 本日勤怠
  const todayRec = await prisma.attendanceRecord.findUnique({
    where: { userId_workDate: { userId: session.id, workDate: dateOnly(now) } },
  });
  const agg = await aggregateMonthly(session.id, year, month);
  const leave = await paidLeaveRemaining(session.id, year);
  const myPending = await prisma.application.count({
    where: { applicantId: session.id, status: { in: ["submitted", "first_approved"] } },
  });
  const myRejected = await prisma.application.count({
    where: { applicantId: session.id, status: { in: ["first_rejected", "second_rejected"] } },
  });
  const unsubmitted = await unsubmittedAttendanceCount(session.id, year, month);

  const recentApps = await prisma.application.findMany({
    where: { applicantId: session.id },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const isApprover = ["first_approver", "second_approver", "admin"].includes(session.role);
  const approvals = isApprover ? await pendingApprovalsFor(session.id) : [];

  // 管理者向け集計
  let adminStats: {
    unconfirmed: number;
    longWorkers: number;
    physicianPending: number;
    paidRate: number;
  } | null = null;
  if (session.role === "admin") {
    const openClosings = await prisma.monthlyAttendanceClosing.count({
      where: { year, month, status: { in: ["open", "submitted", "first_approved"] } },
    });
    const longWorkers = await prisma.laborRiskAlert.count({
      where: { isResolved: false, alertType: { in: ["over45", "over80"] } },
    });
    const physicianPending = await prisma.medicalReviewStatus.count({
      where: { status: "shared" },
    });
    const balances = await prisma.paidLeaveBalance.findMany({ where: { fiscalYear: year } });
    const rate =
      balances.length > 0
        ? Math.round(
            (balances.reduce((s, b) => s + b.usedDays, 0) /
              Math.max(1, balances.reduce((s, b) => s + b.grantedDays, 0))) *
              100,
          )
        : 0;
    adminStats = { unconfirmed: openClosings, longWorkers, physicianPending, paidRate: rate };
  }

  return (
    <div>
      <PageHeader
        title={`おはようございます、${session.name} さん`}
        description={`${year}年${month}月の勤怠サマリー`}
        action={
          <Link href="/attendance" className="btn btn-accent">
            <Clock size={16} /> 勤怠登録へ
          </Link>
        }
      />

      {/* 従業員共通サマリー */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="本日の出勤" value={fmtTime(todayRec?.clockIn)} icon={<Clock size={18} />} tone="accent" />
        <StatCard label="本日の退勤" value={fmtTime(todayRec?.clockOut)} icon={<Clock size={18} />} />
        <StatCard label="今月残業時間" value={minutesToHHMM(agg.overtimeMinutes)} icon={<Timer size={18} />} tone={agg.overtimeMinutes >= 45 * 60 ? "warning" : "default"} />
        <StatCard label="有給残日数" value={leave.remaining} unit="日" icon={<CalendarDays size={18} />} tone="success" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="承認待ち申請" value={myPending} unit="件" href="/applications" icon={<CheckSquare size={18} />} tone="accent" />
        <StatCard label="差戻し申請" value={myRejected} unit="件" href="/applications" icon={<FileWarning size={18} />} tone={myRejected > 0 ? "warning" : "default"} />
        <StatCard label="未提出勤怠" value={unsubmitted} unit="件" href="/attendance/history" icon={<AlertTriangle size={18} />} tone={unsubmitted > 0 ? "warning" : "default"} />
        <StatCard label="今月勤務日数" value={agg.attendanceDays} unit="日" icon={<CalendarDays size={18} />} />
      </div>

      {/* 承認者向け */}
      {isApprover && (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="承認待ち（自分宛）" value={approvals.length} unit="件" href="/approvals" icon={<CheckSquare size={18} />} tone="accent" />
        </div>
      )}

      {/* 管理者向け */}
      {adminStats && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">管理者サマリー</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="月次未確定者" value={adminStats.unconfirmed} unit="人" href="/admin" icon={<Users size={18} />} tone="warning" />
            <StatCard label="長時間労働者" value={adminStats.longWorkers} unit="人" href="/admin/alerts" icon={<AlertTriangle size={18} />} tone="error" />
            <StatCard label="有給取得率" value={adminStats.paidRate} unit="%" icon={<CalendarDays size={18} />} tone="success" />
            <StatCard label="産業医共有待ち" value={adminStats.physicianPending} unit="件" href="/admin/physician-share" icon={<Stethoscope size={18} />} tone="accent" />
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="最近の申請"
          action={<Link href="/applications" className="text-sm text-[var(--accent)]">すべて見る</Link>}
        >
          {recentApps.length === 0 ? (
            <EmptyState message="申請はまだありません。" />
          ) : (
            <div className="space-y-2">
              {recentApps.map((a) => (
                <Link
                  key={a.id}
                  href={`/applications/${a.id}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div>
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {APPLICATION_TYPE_LABELS[a.applicationType]} ・ {fmtDate(a.updatedAt)}
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        {isApprover && (
          <SectionCard
            title="承認待ち（自分宛）"
            action={<Link href="/approvals" className="text-sm text-[var(--accent)]">承認画面へ</Link>}
          >
            {approvals.length === 0 ? (
              <EmptyState message="承認待ちの申請はありません。" />
            ) : (
              <div className="space-y-2">
                {approvals.slice(0, 5).map((a) => (
                  <Link
                    key={a.id}
                    href={`/approvals/${a.id}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <div>
                      <div className="text-sm font-medium">{a.title}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {a.applicant.name} ・ {APPLICATION_TYPE_LABELS[a.applicationType]}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
