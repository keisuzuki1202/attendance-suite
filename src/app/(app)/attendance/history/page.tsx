import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/ui";
import { HistoryAttendanceTable } from "@/components/HistoryAttendanceTable";
import { aggregateMonthly, monthRange } from "@/lib/queries";
import { minutesToHHMM } from "@/lib/attendance";

function parseYm(ym: string | undefined): { year: number; month: number } {
  const now = new Date();
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [y, m] = ym.split("-").map(Number);
    return { year: y, month: m };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const { year, month } = parseYm(sp.ym);
  const { start, end } = monthRange(year, month);

  const records = await prisma.attendanceRecord.findMany({
    where: { userId: session.id, workDate: { gte: start, lt: end } },
    orderBy: { workDate: "asc" },
    include: { workType: { select: { name: true } } },
  });
  const agg = await aggregateMonthly(session.id, year, month);

  return (
    <div>
      <PageHeader
        title="勤怠履歴"
        description={`${year}年${month}月`}
        action={
          <div className="flex gap-2">
            <Link href={`/attendance/history?ym=${shiftMonth(year, month, -1)}`} className="btn btn-outline">前月</Link>
            <Link href={`/attendance/history?ym=${shiftMonth(year, month, 1)}`} className="btn btn-outline">翌月</Link>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="出勤日数" value={agg.attendanceDays} unit="日" />
        <StatCard label="総労働時間" value={minutesToHHMM(agg.totalWorkMinutes)} />
        <StatCard label="残業時間" value={minutesToHHMM(agg.overtimeMinutes)} tone={agg.overtimeMinutes >= 45 * 60 ? "warning" : "default"} />
        <StatCard label="深夜勤務" value={minutesToHHMM(agg.nightMinutes)} />
      </div>

      <HistoryAttendanceTable
        records={records.map((r) => ({
          id: r.id,
          workDate: r.workDate.toISOString(),
          clockIn: r.clockIn?.toISOString() ?? null,
          clockOut: r.clockOut?.toISOString() ?? null,
          breakMinutes: r.breakMinutes,
          workMinutes: r.workMinutes,
          overtimeMinutes: r.overtimeMinutes,
          nightMinutes: r.nightMinutes,
          workTypeName: r.workType?.name ?? null,
          status: r.status,
        }))}
      />
    </div>
  );
}
