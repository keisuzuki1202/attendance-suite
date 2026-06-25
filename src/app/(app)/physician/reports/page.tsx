import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/attendance";

export default async function PhysicianReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "occupational_physician") redirect("/dashboard");

  const reports = await prisma.occupationalHealthReport.findMany({
    where: { status: "shared" },
    include: { _count: { select: { items: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return (
    <div>
      <PageHeader title="共有レポート一覧" description="管理チームから共有された月次レポートです。" />
      {reports.length === 0 ? (
        <EmptyState message="共有されたレポートはありません。" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>対象年月</th><th>対象人数</th><th>共有日</th><th></th></tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.year}年{r.month}月</td>
                  <td>{r._count.items}名</td>
                  <td>{fmtDate(r.sharedAt)}</td>
                  <td><Link href={`/physician/reports/${r.id}`} className="text-sm text-[var(--accent)]">閲覧</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
