import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText, CheckCircle2, Clock } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isApprover } from "@/lib/rbac";
import { PageHeader, StatCard, SectionCard } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { MonthlyActions } from "@/components/MonthlyActions";
import { minutesToHHMM, fmtDate } from "@/lib/attendance";

export default async function MonthlyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const c = await prisma.monthlyAttendanceClosing.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, employeeCode: true } },
      approvalLogs: { include: { approver: { select: { name: true } } } },
    },
  });
  if (!c) notFound();
  if (c.userId !== session.id && !isApprover(session.role)) redirect("/monthly");

  const isOwner = c.userId === session.id;
  const canSubmit = isOwner && ["open", "reopened"].includes(c.status);
  const canApprove =
    isApprover(session.role) &&
    !isOwner &&
    ((c.status === "submitted" && c.firstApproverId === session.id) ||
      (c.status === "first_approved" && c.secondApproverId === session.id));
  const canReopen = session.role === "admin" && c.locked;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`月次勤怠 ${c.year}年${c.month}月`}
        description={`${c.user.name}（${c.user.employeeCode}）`}
        action={
          <Link href={`/monthly/${c.id}/pdf`} className="btn btn-outline">
            <FileText size={16} /> 月次勤怠表PDF
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge status={c.status} />
        {c.locked && <span className="badge badge-muted">ロック済み</span>}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="出勤日数" value={c.attendanceDays} unit="日" />
        <StatCard label="総労働時間" value={minutesToHHMM(c.totalWorkMinutes)} />
        <StatCard label="時間外労働" value={minutesToHHMM(c.overtimeMinutes)} tone={c.overtimeMinutes >= 45 * 60 ? "warning" : "default"} />
        <StatCard label="深夜勤務" value={minutesToHHMM(c.nightMinutes)} />
        <StatCard label="休日勤務" value={c.holidayWorkDays} unit="日" />
        <StatCard label="有給取得" value={c.paidLeaveDays} unit="日" tone="success" />
      </div>

      <div className="mt-6">
        <SectionCard title="電子承認証跡（押印代替）">
          {c.approvalLogs.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">未提出のため承認証跡はありません。</p>
          ) : (
            <div className="space-y-3">
              {c.approvalLogs
                .sort((a, b) => a.stepLevel - b.stepLevel)
                .map((l) => (
                  <div key={l.id} className="flex items-start gap-3">
                    {l.decision === "approved" ? (
                      <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
                    ) : (
                      <Clock size={18} style={{ color: "var(--text-muted)" }} />
                    )}
                    <div className="text-sm">
                      <span className="font-medium">{l.stepLevel}次承認: {l.approver?.name ?? "未設定"}</span>
                      <span className="ml-2 text-xs text-[var(--text-muted)]">
                        {l.decision === "approved" ? `電子承認済 ・ ${fmtDate(l.decidedAt)}` : "承認待ち"}
                      </span>
                      {l.comment && <div className="text-[var(--text-muted)]">{l.comment}</div>}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-4">
        <MonthlyActions id={c.id} canSubmit={canSubmit} canApprove={canApprove} canReopen={canReopen} />
      </div>
    </div>
  );
}
