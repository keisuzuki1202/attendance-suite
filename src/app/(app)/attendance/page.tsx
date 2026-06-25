import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard } from "@/components/ui";
import { AttendanceForm } from "@/components/AttendanceForm";
import { MonthlyAttendanceTable } from "@/components/MonthlyAttendanceTable";
import { monthRange } from "@/lib/queries";
import { dateOnly, toDatetimeLocal, toDateInput } from "@/lib/attendance";

export default async function AttendancePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const now = new Date();
  const today = dateOnly(now);
  const workTypes = await prisma.workType.findMany({ orderBy: { code: "asc" } });
  // 勤務区分の既定値は「通常勤務」(NORMAL)
  const defaultWorkTypeId =
    workTypes.find((w) => w.code === "NORMAL")?.id ?? workTypes[0]?.id ?? "";
  const todayRec = await prisma.attendanceRecord.findUnique({
    where: { userId_workDate: { userId: session.id, workDate: today } },
  });
  // 当月分の勤怠をすべて取得
  const { start, end } = monthRange(now.getFullYear(), now.getMonth() + 1);
  const monthly = await prisma.attendanceRecord.findMany({
    where: { userId: session.id, workDate: { gte: start, lt: end } },
    orderBy: { workDate: "asc" },
    include: { workType: { select: { name: true } } },
  });

  return (
    <div>
      <PageHeader
        title="勤怠登録"
        description="PC起動/終了で自動記録された時刻を確認・修正できます。"
        action={
          <Link href="/applications/new/correction" className="btn btn-outline">
            打刻修正を申請
          </Link>
        }
      />

      {todayRec?.status === "needs_review" && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
          style={{ color: "var(--warning)", borderColor: "var(--warning)", background: "color-mix(in srgb, var(--warning) 8%, transparent)" }}
        >
          <span>
            勤務開始が所定始業（09:00）より後に打刻されています。<strong>打刻修正の申請</strong>が必要です。
          </span>
          <Link href={`/applications/new/correction?recordId=${todayRec?.id}`} className="btn btn-warning px-3 py-1 text-xs whitespace-nowrap">
            打刻修正を申請
          </Link>
        </div>
      )}

      <AttendanceForm
        workTypes={workTypes.map((w) => ({ id: w.id, name: w.name }))}
        initial={{
          workDate: toDateInput(today),
          clockIn: toDatetimeLocal(todayRec?.clockIn),
          clockOut: toDatetimeLocal(todayRec?.clockOut),
          breakMinutes: todayRec?.breakMinutes ?? 60,
          workTypeId: todayRec?.workTypeId ?? defaultWorkTypeId,
          note: todayRec?.note ?? "",
          locked: todayRec?.locked ?? false,
          source: todayRec?.source ?? "manual",
        }}
      />

      <div className="mt-6">
        <SectionCard
          title={`当月の勤怠（${now.getFullYear()}年${now.getMonth() + 1}月）`}
          action={<Link href="/attendance/history" className="text-sm text-[var(--accent)]">履歴を見る</Link>}
        >
          <p className="mb-2 text-xs text-[var(--text-muted)]">行をクリックすると勤怠の詳細を表示します。</p>
          <MonthlyAttendanceTable
            records={monthly.map((r) => ({
              id: r.id,
              workDate: r.workDate.toISOString(),
              clockIn: r.clockIn?.toISOString() ?? null,
              clockOut: r.clockOut?.toISOString() ?? null,
              breakMinutes: r.breakMinutes,
              workMinutes: r.workMinutes,
              overtimeMinutes: r.overtimeMinutes,
              workTypeName: r.workType?.name ?? null,
              source: r.source,
              status: r.status,
            }))}
          />
        </SectionCard>
      </div>
    </div>
  );
}
