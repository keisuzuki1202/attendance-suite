import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui";
import { ALERT_TYPE_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/attendance";

const SEVERITY: Record<string, { label: string; cls: string }> = {
  critical: { label: "重大", cls: "badge-error" },
  warning: { label: "警告", cls: "badge-warning" },
  info: { label: "情報", cls: "badge-info" },
};

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const alerts = await prisma.laborRiskAlert.findMany({
    include: { user: { select: { name: true, employeeCode: true } } },
    orderBy: [{ createdAt: "desc" }],
  });

  return (
    <div>
      <PageHeader
        title="長時間労働アラート"
        description="36協定しきい値（45h/80h）や深夜・休日勤務などの労務リスクを自動検知します。"
        action={
          <Link href="/api/admin/export/long-workers" className="btn btn-outline">
            <Download size={16} /> 長時間労働者CSV
          </Link>
        }
      />
      {alerts.length === 0 ? (
        <EmptyState message="アラートはありません。" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>重要度</th>
                <th>種別</th>
                <th>対象者</th>
                <th>対象月</th>
                <th>内容</th>
                <th>検知日</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => {
                const sev = SEVERITY[a.severity] ?? SEVERITY.info;
                return (
                  <tr key={a.id}>
                    <td><span className={`badge ${sev.cls}`}>{sev.label}</span></td>
                    <td>{ALERT_TYPE_LABELS[a.alertType] ?? a.alertType}</td>
                    <td>{a.user.name}（{a.user.employeeCode}）</td>
                    <td>{a.year}/{a.month}</td>
                    <td>{a.message}</td>
                    <td>{fmtDate(a.createdAt)}</td>
                    <td>
                      {a.isResolved ? (
                        <span className="badge badge-muted">対応済</span>
                      ) : (
                        <span className="badge badge-warning">未対応</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
