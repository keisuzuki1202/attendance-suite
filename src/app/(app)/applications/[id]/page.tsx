import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { ApplicationDetailView } from "@/components/ApplicationDetailView";
import { ApplicantActions } from "@/components/AppActions";

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

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const app = await prisma.application.findUnique({ where: { id }, include });
  if (!app) notFound();
  // 本人のみ（または管理者）閲覧可
  if (app.applicantId !== session.id && session.role !== "admin") {
    redirect("/applications");
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="申請詳細" description="ステータスと承認状況を確認できます。" />
      <ApplicationDetailView app={app} />
      <div className="mt-4">
        <ApplicantActions id={app.id} status={app.status} />
      </div>
    </div>
  );
}
