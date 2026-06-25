import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Clock, CheckCircle2, AlertTriangle, Stethoscope } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard, SectionCard, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { minutesToHHMM } from "@/lib/attendance";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const now = new Date();
  const [
    unconfirmed,
    awaiting,
    completed,
    over45,
    over80,
    sharePending,
    reviewed,
  ] = await Promise.all([
    prisma.monthlyAttendanceClosing.count({ where: { status: { in: ["open", "reopened"] } } }),
    prisma.monthlyAttendanceClosing.count({ where: { status: { in: ["submitted", "first_approved"] } } }),
    prisma.monthlyAttendanceClosing.count({ where: { status: "second_approved" } }),
    prisma.laborRiskAlert.count({ where: { alertType: "over45", isResolved: false } }),
    prisma.laborRiskAlert.count({ where: { alertType: "over80", isResolved: false } }),
    prisma.medicalReviewStatus.count({ where: { status: "shared" } }),
    prisma.medicalReviewStatus.count({ where: { status: "physician_reviewed" } }),
  ]);

  const longWorkers = await prisma.occupationalHealthReportItem.findMany({
    where: { over45: true },
    include: {
      user: { select: { name: true } },
      department: { select: { name: true } },
      report: { select: { year: true, month: true } },
    },
    orderBy: { overtimeMinutes: "desc" },
    take: 10,
  });

  const unconfirmedList = await prisma.monthlyAttendanceClosing.findMany({
    where: { status: { in: ["open", "reopened", "submitted", "first_approved"] } },
    include: { user: { select: { name: true, employeeCode: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 10,
  });

  return (
    <div>
      <PageHeader
        title="管理チームダッシュボード"
        description={`${now.getFullYear()}年${now.getMonth() + 1}月時点｜紙の勤務表提出に代わる労務状況の一元管理`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="月次未確定者" value={unconfirmed} unit="人" icon={<Users size={18} />} tone="warning" />
        <StatCard label="承認待ち" value={awaiting} unit="件" icon={<Clock size={18} />} tone="accent" />
        <StatCard label="承認完了" value={completed} unit="件" icon={<CheckCircle2 size={18} />} tone="success" />
        <StatCard label="45時間超過" value={over45} unit="人" href="/admin/alerts" icon={<AlertTriangle size={18} />} tone="warning" />
        <StatCard label="80時間超過" value={over80} unit="人" href="/admin/alerts" icon={<AlertTriangle size={18} />} tone="error" />
        <StatCard label="産業医共有待ち" value={sharePending} unit="件" href="/admin/physician-share" icon={<Stethoscope size={18} />} tone="accent" />
        <StatCard label="産業医確認済み" value={reviewed} unit="件" href="/admin/physician-share" icon={<Stethoscope size={18} />} tone="success" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="長時間労働者（45時間超）"
          action={<Link href="/admin/physician-share" className="text-sm text-[var(--accent)]">産業医共有へ</Link>}
        >
          {longWorkers.length === 0 ? (
            <EmptyState message="該当者はいません。" />
          ) : (
            <table className="table-base">
              <thead>
                <tr><th>氏名</th><th>所属</th><th>対象月</th><th>残業</th><th></th></tr>
              </thead>
              <tbody>
                {longWorkers.map((w) => (
                  <tr key={w.id}>
                    <td>{w.user.name}</td>
                    <td>{w.department?.name ?? "—"}</td>
                    <td>{w.report.year}/{w.report.month}</td>
                    <td className="font-semibold" style={{ color: w.over80 ? "var(--error)" : "var(--warning)" }}>
                      {minutesToHHMM(w.overtimeMinutes)}
                    </td>
                    <td>{w.interviewCandidate && <span className="badge badge-warning">面談候補</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard
          title="月次勤怠 未確定/承認中"
          action={<Link href="/admin/alerts" className="text-sm text-[var(--accent)]">アラート一覧</Link>}
        >
          {unconfirmedList.length === 0 ? (
            <EmptyState message="未確定者はいません。" />
          ) : (
            <table className="table-base">
              <thead>
                <tr><th>氏名</th><th>対象月</th><th>状態</th><th></th></tr>
              </thead>
              <tbody>
                {unconfirmedList.map((c) => (
                  <tr key={c.id}>
                    <td>{c.user.name}（{c.user.employeeCode}）</td>
                    <td>{c.year}/{c.month}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td><Link href={`/monthly/${c.id}`} className="text-sm text-[var(--accent)]">確認</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
