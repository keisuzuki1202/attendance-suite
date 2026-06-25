import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Download } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui";
import { GenerateReport, ShareButton } from "@/components/PhysicianShareControls";
import { minutesToHHMM } from "@/lib/attendance";

export default async function PhysicianSharePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const reports = await prisma.occupationalHealthReport.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      items: {
        include: {
          user: { select: { name: true } },
          department: { select: { name: true } },
          reviewStatus: true,
        },
        orderBy: { overtimeMinutes: "desc" },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="産業医共有対象者"
        description="長時間労働者を自動抽出し、産業医へ電子的に共有します（紙・押印不要）。"
      />

      <div className="mb-6">
        <GenerateReport />
      </div>

      {reports.length === 0 ? (
        <EmptyState message="レポートがありません。上で対象年月を指定して生成してください。" />
      ) : (
        <div className="space-y-6">
          {reports.map((r) => (
            <SectionCard
              key={r.id}
              title={`${r.year}年${r.month}月 共有レポート（${r.items.length}名）`}
              action={
                <div className="flex items-center gap-2">
                  <Link href={`/api/reports/${r.id}/csv`} className="btn btn-outline px-3 py-1 text-xs">
                    <Download size={14} /> CSV
                  </Link>
                  <Link href={`/physician/reports/${r.id}`} className="btn btn-outline px-3 py-1 text-xs">
                    <FileText size={14} /> プレビュー
                  </Link>
                  <ShareButton reportId={r.id} shared={r.status === "shared"} />
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>氏名</th>
                      <th>所属</th>
                      <th>時間外</th>
                      <th>深夜</th>
                      <th>休日</th>
                      <th>区分</th>
                      <th>産業医確認</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((it) => (
                      <tr key={it.id}>
                        <td>{it.user.name}</td>
                        <td>{it.department?.name ?? "—"}</td>
                        <td className="font-semibold" style={{ color: it.over80 ? "var(--error)" : it.over45 ? "var(--warning)" : "inherit" }}>
                          {minutesToHHMM(it.overtimeMinutes)}
                        </td>
                        <td>{minutesToHHMM(it.nightMinutes)}</td>
                        <td>{it.holidayWorkDays}日</td>
                        <td>
                          {it.over80 && <span className="badge badge-error mr-1">80h超</span>}
                          {it.over45 && !it.over80 && <span className="badge badge-warning mr-1">45h超</span>}
                          {it.interviewCandidate && <span className="badge badge-warning">面談候補</span>}
                        </td>
                        <td>
                          {it.reviewStatus?.status === "physician_reviewed" ? (
                            <span className="badge badge-success">確認済み</span>
                          ) : it.reviewStatus?.status === "shared" ? (
                            <span className="badge badge-info">共有済み</span>
                          ) : (
                            <span className="badge badge-muted">未共有</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
