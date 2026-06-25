import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, AlertTriangle, Stethoscope, CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard, SectionCard, EmptyState } from "@/components/ui";
import { minutesToHHMM } from "@/lib/attendance";

export default async function PhysicianDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "occupational_physician") redirect("/dashboard");

  // 共有済みレポートのみ閲覧可（最小権限・健康管理に必要な情報のみ）
  const items = await prisma.occupationalHealthReportItem.findMany({
    where: { report: { status: "shared" } },
    include: {
      user: { select: { name: true } },
      department: { select: { name: true } },
      report: { select: { year: true, month: true } },
      reviewStatus: true,
    },
    orderBy: { overtimeMinutes: "desc" },
  });

  const over45 = items.filter((i) => i.over45 && !i.over80).length;
  const over80 = items.filter((i) => i.over80).length;
  const candidates = items.filter((i) => i.interviewCandidate).length;
  const reviewed = items.filter((i) => i.reviewStatus?.status === "physician_reviewed").length;

  return (
    <div>
      <PageHeader
        title="産業医ダッシュボード"
        description="管理チームから共有された勤務時間情報のみを表示しています（最小権限）。"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="共有対象者" value={items.length} unit="人" icon={<Users size={18} />} tone="accent" />
        <StatCard label="45時間超過" value={over45} unit="人" icon={<AlertTriangle size={18} />} tone="warning" />
        <StatCard label="80時間超過" value={over80} unit="人" icon={<AlertTriangle size={18} />} tone="error" />
        <StatCard label="面談候補者" value={candidates} unit="人" icon={<Stethoscope size={18} />} tone="warning" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="確認済み" value={reviewed} unit="人" icon={<CheckCircle2 size={18} />} tone="success" />
      </div>

      <div className="mt-6">
        <SectionCard title="面談候補者一覧">
          {candidates === 0 ? (
            <EmptyState message="面談候補者はいません。" />
          ) : (
            <table className="table-base">
              <thead>
                <tr><th>氏名</th><th>所属</th><th>対象月</th><th>時間外</th><th>深夜</th><th>確認</th><th></th></tr>
              </thead>
              <tbody>
                {items.filter((i) => i.interviewCandidate).map((i) => (
                  <tr key={i.id}>
                    <td>{i.user.name}</td>
                    <td>{i.department?.name ?? "—"}</td>
                    <td>{i.report.year}/{i.report.month}</td>
                    <td className="font-semibold" style={{ color: i.over80 ? "var(--error)" : "var(--warning)" }}>
                      {minutesToHHMM(i.overtimeMinutes)}
                    </td>
                    <td>{minutesToHHMM(i.nightMinutes)}</td>
                    <td>
                      {i.reviewStatus?.status === "physician_reviewed"
                        ? <span className="badge badge-success">確認済</span>
                        : <span className="badge badge-info">未確認</span>}
                    </td>
                    <td>
                      <Link href={`/physician/reports/${i.reportId}`} className="text-sm text-[var(--accent)]">詳細</Link>
                    </td>
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
