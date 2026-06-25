import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Power, PowerOff } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard, SectionCard } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate, fmtTime, minutesToHHMM, dateOnly } from "@/lib/attendance";
import { APPLICATION_TYPE_LABELS, TRIP_TYPE_LABELS } from "@/lib/constants";

const EVENT_LABELS: Record<string, string> = {
  startup: "起動",
  shutdown: "シャットダウン",
  logon: "ログオン",
  logoff: "ログオフ",
};

export default async function AttendanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const rec = await prisma.attendanceRecord.findUnique({
    where: { id },
    include: {
      workType: { select: { name: true } },
      user: { select: { name: true, employeeCode: true } },
      correctionRequests: {
        include: { application: { select: { id: true, status: true, title: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!rec) notFound();
  if (rec.userId !== session.id && session.role !== "admin") redirect("/attendance");

  // 当日のPC起動/終了ログ
  const dayStart = dateOnly(rec.workDate);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const logs = await prisma.pcActivityLog.findMany({
    where: { userId: rec.userId, occurredAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { occurredAt: "asc" },
  });

  // この日に関連する申請（有給/出張/研修）— 該当日時の範囲が当日に重なるもの
  const candidates = await prisma.application.findMany({
    where: {
      applicantId: rec.userId,
      applicationType: { in: ["paid_leave", "business_trip", "training"] },
      targetStartAt: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });
  const relatedApps = candidates.filter((a) => {
    const s = a.targetStartAt!;
    const e = a.targetEndAt ?? a.targetStartAt!;
    return s < dayEnd && e >= dayStart;
  });

  const isOwner = rec.userId === session.id;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`勤怠詳細 ${fmtDate(rec.workDate)}`}
        description={`${rec.user.name}（${rec.user.employeeCode}）`}
        action={
          <Link href="/attendance" className="btn btn-ghost">
            ← 勤怠登録へ戻る
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={rec.status} />
        <span className="badge badge-muted">{rec.source === "auto" ? "PC自動打刻" : "手動入力"}</span>
        {rec.locked && <span className="badge badge-muted">ロック済み</span>}
        <span className="badge badge-info">{rec.workType?.name ?? "区分未設定"}</span>
      </div>

      {rec.status === "needs_review" && isOwner && !rec.locked && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
          style={{ color: "var(--warning)", borderColor: "var(--warning)", background: "color-mix(in srgb, var(--warning) 8%, transparent)" }}
        >
          <span>勤務開始が所定始業（09:00）より後に打刻されています。打刻修正の申請が必要です。</span>
          <Link href={`/applications/new/correction?recordId=${rec.id}`} className="btn btn-warning px-3 py-1 text-xs whitespace-nowrap">
            打刻修正を申請
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="出勤" value={fmtTime(rec.clockIn)} tone="accent" />
        <StatCard label="退勤" value={fmtTime(rec.clockOut)} />
        <StatCard label="休憩" value={rec.breakMinutes} unit="分" />
        <StatCard label="実働" value={minutesToHHMM(rec.workMinutes)} />
        <StatCard label="時間外（17:30以降）" value={minutesToHHMM(rec.overtimeMinutes)} tone={rec.overtimeMinutes > 0 ? "warning" : "default"} />
        <StatCard label="深夜勤務" value={minutesToHHMM(rec.nightMinutes)} />
        <StatCard label="休日勤務" value={rec.isHolidayWork ? "あり" : "なし"} />
      </div>

      {rec.note && (
        <div className="card mt-4 p-4 text-sm">
          <span className="font-medium text-[var(--text-muted)]">備考: </span>
          {rec.note}
        </div>
      )}

      <div className="mt-6">
        <SectionCard title="PC起動 / 終了ログ（監査証跡）">
          {logs.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">この日のPC打刻ログはありません。</p>
          ) : (
            <table className="table-base">
              <thead>
                <tr><th>イベント</th><th>時刻</th><th>端末</th><th>IP</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span className="inline-flex items-center gap-1">
                        {l.eventType === "startup" || l.eventType === "logon"
                          ? <Power size={14} style={{ color: "var(--success)" }} />
                          : <PowerOff size={14} style={{ color: "var(--text-muted)" }} />}
                        {EVENT_LABELS[l.eventType] ?? l.eventType}
                      </span>
                    </td>
                    <td>{fmtTime(l.occurredAt)}</td>
                    <td>{l.terminalId}</td>
                    <td>{l.ipAddress ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>

      {relatedApps.length > 0 && (
        <div className="mt-4">
          <SectionCard title="この日に関連する申請（有給・出張・研修）">
            <div className="space-y-2">
              {relatedApps.map((a) => (
                <Link
                  key={a.id}
                  href={`/applications/${a.id}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div>
                    <div className="text-sm font-medium">
                      <span className="badge badge-info mr-2">
                        {APPLICATION_TYPE_LABELS[a.applicationType]}
                        {a.applicationType === "business_trip" && a.tripType
                          ? `・${TRIP_TYPE_LABELS[a.tripType] ?? a.tripType}`
                          : ""}
                      </span>
                      {a.title}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {fmtDate(a.targetStartAt)}
                      {a.targetEndAt ? ` 〜 ${fmtDate(a.targetEndAt)}` : ""}
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {rec.correctionRequests.length > 0 && (
        <div className="mt-4">
          <SectionCard title="打刻修正の履歴">
            <div className="space-y-2">
              {rec.correctionRequests.map((c) => (
                <Link
                  key={c.id}
                  href={`/applications/${c.application.id}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div>
                    <div className="text-sm font-medium">{c.application.title}</div>
                    <div className="text-xs text-[var(--text-muted)]">理由: {c.reason}</div>
                  </div>
                  <StatusBadge status={c.application.status} />
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
