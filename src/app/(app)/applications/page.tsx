import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { APPLICATION_TYPE_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/attendance";

export default async function ApplicationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const apps = await prisma.application.findMany({
    where: { applicantId: session.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="申請ステータス一覧"
        description="自分の申請の状態を確認できます。"
        action={
          <Link href="/applications/new/paid_leave" className="btn btn-accent">
            新規申請
          </Link>
        }
      />
      {apps.length === 0 ? (
        <EmptyState message="申請はまだありません。" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>種別</th>
                <th>タイトル</th>
                <th>該当日</th>
                <th>更新日</th>
                <th>ステータス</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  <td>{APPLICATION_TYPE_LABELS[a.applicationType]}</td>
                  <td className="font-medium">{a.title}</td>
                  <td>{a.targetStartAt ? fmtDate(a.targetStartAt) : "—"}</td>
                  <td>{fmtDate(a.updatedAt)}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    <Link href={`/applications/${a.id}`} className="text-sm text-[var(--accent)]">
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
