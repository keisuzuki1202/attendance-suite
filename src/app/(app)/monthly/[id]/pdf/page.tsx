import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isApprover } from "@/lib/rbac";
import { PrintButton } from "@/components/PrintButton";
import { minutesToHHMM, fmtDate } from "@/lib/attendance";

export default async function MonthlyPdfPage({
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
      user: { select: { name: true, employeeCode: true, department: { select: { name: true } } } },
      approvalLogs: { include: { approver: { select: { name: true } } } },
    },
  });
  if (!c) notFound();
  if (c.userId !== session.id && !isApprover(session.role) && session.role !== "admin")
    redirect("/monthly");

  const step1 = c.approvalLogs.find((l) => l.stepLevel === 1);
  const step2 = c.approvalLogs.find((l) => l.stepLevel === 2);
  const approved = c.status === "second_approved";

  const rows: [string, string][] = [
    ["従業員名", `${c.user.name}（${c.user.employeeCode}）`],
    ["所属", c.user.department?.name ?? "—"],
    ["対象年月", `${c.year}年 ${c.month}月`],
    ["出勤日数", `${c.attendanceDays} 日`],
    ["総労働時間", minutesToHHMM(c.totalWorkMinutes)],
    ["時間外労働時間", minutesToHHMM(c.overtimeMinutes)],
    ["深夜勤務時間", minutesToHHMM(c.nightMinutes)],
    ["休日勤務日数", `${c.holidayWorkDays} 日`],
    ["有給取得日数", `${c.paidLeaveDays} 日`],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end">
        <PrintButton />
      </div>

      <div className="card p-8">
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <Image src="/assets/logo.svg" alt="ロゴ" width={44} height={44} />
            <div>
              <div className="text-lg font-bold">月次勤怠表</div>
              <div className="text-xs text-[var(--text-muted)]">勤怠管理システム</div>
            </div>
          </div>
          {approved && (
            <div className="flex items-center gap-1 rounded-lg border px-3 py-1 text-sm font-semibold" style={{ color: "var(--success)", borderColor: "var(--success)" }}>
              <CheckCircle2 size={16} /> 電子承認済み
            </div>
          )}
        </div>

        <table className="table-base mb-6">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="w-1/3 font-medium text-[var(--text-muted)]">{k}</td>
                <td className="font-semibold">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-[var(--text-muted)]">1次承認者</div>
            <div className="mt-1 font-semibold">{step1?.approver?.name ?? "—"}</div>
            <div className="text-xs text-[var(--text-muted)]">
              {step1?.decision === "approved" ? `承認日時: ${fmtDate(step1.decidedAt)}` : "未承認"}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-[var(--text-muted)]">2次承認者</div>
            <div className="mt-1 font-semibold">{step2?.approver?.name ?? "—"}</div>
            <div className="text-xs text-[var(--text-muted)]">
              {step2?.decision === "approved" ? `承認日時: ${fmtDate(step2.decidedAt)}` : "未承認"}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          本帳票は電子承認により確定されています。物理的な押印は不要です。
        </p>
      </div>
    </div>
  );
}
