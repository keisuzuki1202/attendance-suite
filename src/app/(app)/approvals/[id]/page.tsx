import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isApprover } from "@/lib/rbac";
import { isUsersTurn } from "@/lib/queries";
import { PageHeader, SectionCard } from "@/components/ui";
import { ApplicationDetailView } from "@/components/ApplicationDetailView";
import { ApproverActions } from "@/components/AppActions";

const include = {
  applicant: { select: { name: true, employeeCode: true } },
  approvalSteps: { include: { approver: { select: { name: true } } } },
  approvalComments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { name: true } } },
  },
  correctionRequest: {
    include: { attendanceRecord: { select: { workDate: true } } },
  },
};

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isApprover(session.role)) redirect("/dashboard");

  const app = await prisma.application.findUnique({ where: { id }, include });
  if (!app) notFound();

  const myTurn =
    isUsersTurn(app, session.id) && app.applicantId !== session.id;

  return (
    <div className="max-w-3xl">
      <PageHeader title="申請詳細・承認" description="内容を確認し、承認または差戻しを行ってください。" />
      <ApplicationDetailView app={app} />
      <div className="mt-4">
        {myTurn ? (
          <SectionCard title="承認アクション">
            <ApproverActions id={app.id} />
          </SectionCard>
        ) : (
          <div className="card p-4 text-sm text-[var(--text-muted)]">
            現在この申請に対してあなたが実行できる承認操作はありません
            （順序待ち・処理済み・本人申請のいずれか）。
          </div>
        )}
      </div>
    </div>
  );
}
