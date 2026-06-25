import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/api";
import { PageHeader, StatCard, SectionCard } from "@/components/ui";
import { PhysicianItemActions } from "@/components/PhysicianItemActions";
import { PrintButton } from "@/components/PrintButton";
import { minutesToHHMM, fmtDate } from "@/lib/attendance";

export default async function PhysicianReportDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "occupational_physician") redirect("/dashboard");

  const report = await prisma.occupationalHealthReport.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          user: { select: { name: true, employeeCode: true } },
          department: { select: { name: true } },
          reviewStatus: true,
          comments: {
            include: { physician: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { overtimeMinutes: "desc" },
      },
    },
  });
  if (!report || report.status !== "shared") notFound();

  // 産業医閲覧ログ (要件15.8) — 最小権限・閲覧監査
  await writeAudit({
    actorId: session.id,
    action: "physician_view",
    entityType: "OccupationalHealthReport",
    entityId: report.id,
    after: { year: report.year, month: report.month },
  });

  return (
    <div>
      <PageHeader
        title={`勤務時間情報 ${report.year}年${report.month}月`}
        description="健康管理に必要な勤務時間情報のみを表示しています。給与・人事評価情報は含まれません。"
        action={<PrintButton label="レポート印刷/PDF" />}
      />

      {report.note && (
        <div className="card mb-4 p-4">
          <div className="text-xs font-semibold text-[var(--text-muted)]">管理チームからのコメント</div>
          <p className="mt-1 text-sm">{report.note}</p>
        </div>
      )}

      <div className="space-y-4">
        {report.items.map((it) => (
          <SectionCard
            key={it.id}
            title={`${it.user.name}（${it.department?.name ?? "—"}）`}
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard label="総労働" value={minutesToHHMM(it.totalWorkMinutes)} />
              <StatCard label="時間外" value={minutesToHHMM(it.overtimeMinutes)} tone={it.over80 ? "error" : it.over45 ? "warning" : "default"} />
              <StatCard label="深夜勤務" value={minutesToHHMM(it.nightMinutes)} />
              <StatCard label="休日勤務" value={it.holidayWorkDays} unit="日" />
              <StatCard label="有給取得" value={it.paidLeaveDays} unit="日" tone="success" />
            </div>

            <div className="mt-3 flex gap-2">
              {it.over80 && <span className="badge badge-error">80h超</span>}
              {it.over45 && !it.over80 && <span className="badge badge-warning">45h超</span>}
              {it.interviewCandidate && <span className="badge badge-warning">面談候補</span>}
            </div>

            {it.comments.length > 0 && (
              <div className="mt-3 space-y-1">
                {it.comments.map((c) => (
                  <div key={c.id} className="rounded bg-black/5 px-3 py-1.5 text-sm dark:bg-white/5">
                    {c.body}
                    <span className="ml-2 text-xs text-[var(--text-muted)]">
                      {c.physician.name} ・ {fmtDate(c.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3">
              <PhysicianItemActions
                itemId={it.id}
                reviewed={it.reviewStatus?.status === "physician_reviewed"}
              />
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
