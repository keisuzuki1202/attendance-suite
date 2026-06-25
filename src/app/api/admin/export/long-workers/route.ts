import { authed, fail, writeAudit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";
import { minutesToHHMM } from "@/lib/attendance";

// 長時間労働者一覧CSV (要件15.7)
export async function GET() {
  const { user, res } = await authed();
  if (!user) return res;
  if (user.role !== "admin") return fail("管理者のみ実行できます。", 403);

  const items = await prisma.occupationalHealthReportItem.findMany({
    where: { over45: true },
    include: {
      user: { select: { name: true, employeeCode: true } },
      department: { select: { name: true } },
      report: { select: { year: true, month: true } },
    },
    orderBy: { overtimeMinutes: "desc" },
  });

  const csv = toCsv(
    ["対象年", "対象月", "氏名", "社員番号", "所属", "時間外労働", "深夜勤務", "休日勤務日数", "区分"],
    items.map((it) => [
      it.report.year,
      it.report.month,
      it.user.name,
      it.user.employeeCode,
      it.department?.name ?? "",
      minutesToHHMM(it.overtimeMinutes),
      minutesToHHMM(it.nightMinutes),
      it.holidayWorkDays,
      it.over80 ? "80h超" : "45h超",
    ]),
  );

  await writeAudit({
    actorId: user.id,
    action: "export_csv",
    entityType: "LaborRiskAlert",
    after: { filename: "長時間労働者一覧.csv" },
  });

  return csvResponse("長時間労働者一覧.csv", csv);
}
