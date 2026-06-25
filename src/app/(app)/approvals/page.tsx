import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isApprover } from "@/lib/rbac";
import { pendingApprovalsFor, isUsersTurn } from "@/lib/queries";
import { PageHeader, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { APPLICATION_TYPE_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/attendance";

export default async function ApprovalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isApprover(session.role)) redirect("/dashboard");

  const all = await pendingApprovalsFor(session.id);
  // 「自分のターン」のものだけを承認待ちとして表示
  const apps = all.filter((a) => isUsersTurn(a, session.id));

  return (
    <div>
      <PageHeader
        title="承認待ち一覧"
        description="あなたの承認順序が来ている申請です。"
      />
      {apps.length === 0 ? (
        <EmptyState message="承認待ちの申請はありません。" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>申請者</th>
                <th>種別</th>
                <th>タイトル</th>
                <th>提出日</th>
                <th>段階</th>
                <th>ステータス</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  <td>{a.applicant.name}</td>
                  <td>{APPLICATION_TYPE_LABELS[a.applicationType]}</td>
                  <td className="font-medium">{a.title}</td>
                  <td>{a.submittedAt ? fmtDate(a.submittedAt) : "—"}</td>
                  <td>{a.currentStepLevel}次</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    <Link href={`/approvals/${a.id}`} className="btn btn-accent px-3 py-1 text-xs">
                      承認する
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
