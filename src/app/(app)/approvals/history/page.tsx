import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isApprover } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/ui";
import { APPLICATION_TYPE_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/attendance";

export default async function ApprovalHistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isApprover(session.role)) redirect("/dashboard");

  const steps = await prisma.applicationApprovalStep.findMany({
    where: { approverId: session.id, decision: { in: ["approved", "rejected"] } },
    include: {
      application: {
        include: { applicant: { select: { name: true } } },
      },
    },
    orderBy: { decidedAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader title="承認履歴" description="あなたが処理した承認・差戻しの履歴です。" />
      {steps.length === 0 ? (
        <EmptyState message="承認履歴はありません。" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>処理日</th><th>申請者</th><th>種別</th><th>タイトル</th><th>段階</th><th>判定</th><th></th></tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.decidedAt)}</td>
                  <td>{s.application.applicant.name}</td>
                  <td>{APPLICATION_TYPE_LABELS[s.application.applicationType]}</td>
                  <td className="font-medium">{s.application.title}</td>
                  <td>{s.stepLevel}次</td>
                  <td>
                    {s.decision === "approved"
                      ? <span className="badge badge-success">承認</span>
                      : <span className="badge badge-warning">差戻し</span>}
                  </td>
                  <td><Link href={`/approvals/${s.application.id}`} className="text-sm text-[var(--accent)]">詳細</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
