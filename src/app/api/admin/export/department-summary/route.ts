import { authed, fail, writeAudit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";
import { minutesToHHMM } from "@/lib/attendance";

// 部門別勤怠サマリーCSV (要件15.7)
export async function GET() {
  const { user, res } = await authed();
  if (!user) return res;
  if (user.role !== "admin") return fail("管理者のみ実行できます。", 403);

  const closings = await prisma.monthlyAttendanceClosing.findMany({
    where: { status: "second_approved" },
    include: { user: { select: { department: { select: { name: true } } } } },
  });

  const map = new Map<
    string,
    { count: number; work: number; ot: number; night: number; holiday: number; paid: number }
  >();
  for (const c of closings) {
    const dep = c.user.department?.name ?? "未所属";
    const cur = map.get(dep) ?? { count: 0, work: 0, ot: 0, night: 0, holiday: 0, paid: 0 };
    cur.count += 1;
    cur.work += c.totalWorkMinutes;
    cur.ot += c.overtimeMinutes;
    cur.night += c.nightMinutes;
    cur.holiday += c.holidayWorkDays;
    cur.paid += c.paidLeaveDays;
    map.set(dep, cur);
  }

  const csv = toCsv(
    ["部門", "対象人数", "総労働時間", "平均時間外", "深夜勤務計", "休日勤務日数計", "有給取得日数計"],
    [...map.entries()].map(([dep, v]) => [
      dep,
      v.count,
      minutesToHHMM(v.work),
      minutesToHHMM(Math.round(v.ot / Math.max(1, v.count))),
      minutesToHHMM(v.night),
      v.holiday,
      v.paid,
    ]),
  );

  await writeAudit({
    actorId: user.id,
    action: "export_csv",
    entityType: "Department",
    after: { filename: "部門別勤怠サマリー.csv" },
  });

  return csvResponse("部門別勤怠サマリー.csv", csv);
}
