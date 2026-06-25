import type { NextRequest } from "next/server";
import { authed, fail, writeAudit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";
import { minutesToHHMM } from "@/lib/attendance";

// 産業医共有レポートCSV (要件15.7)。管理者・産業医のみ。
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, res } = await authed();
  if (!user) return res;
  if (user.role !== "admin" && user.role !== "occupational_physician")
    return fail("権限がありません。", 403);
  const { id } = await ctx.params;

  const report = await prisma.occupationalHealthReport.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          user: { select: { name: true, employeeCode: true } },
          department: { select: { name: true } },
        },
        orderBy: { overtimeMinutes: "desc" },
      },
    },
  });
  if (!report) return fail("レポートが見つかりません。", 404);

  const csv = toCsv(
    ["氏名", "社員番号", "所属", "総労働時間", "時間外労働", "深夜勤務", "休日勤務日数", "有給取得日数", "45h超", "80h超", "面談候補"],
    report.items.map((it) => [
      it.user.name,
      it.user.employeeCode,
      it.department?.name ?? "",
      minutesToHHMM(it.totalWorkMinutes),
      minutesToHHMM(it.overtimeMinutes),
      minutesToHHMM(it.nightMinutes),
      it.holidayWorkDays,
      it.paidLeaveDays,
      it.over45 ? "○" : "",
      it.over80 ? "○" : "",
      it.interviewCandidate ? "○" : "",
    ]),
  );

  // ダウンロード履歴を監査ログに記録 (要件15.8)
  await writeAudit({
    actorId: user.id,
    action: "export_csv",
    entityType: "OccupationalHealthReport",
    entityId: report.id,
    after: { filename: `産業医共有レポート_${report.year}_${report.month}.csv` },
  });

  return csvResponse(`産業医共有レポート_${report.year}_${report.month}.csv`, csv);
}
