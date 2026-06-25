import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isApprover } from "@/lib/rbac";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { minutesToHHMM } from "@/lib/attendance";

export default async function MonthlyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const mine = await prisma.monthlyAttendanceClosing.findMany({
    where: { userId: session.id },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const awaiting = isApprover(session.role)
    ? await prisma.monthlyAttendanceClosing.findMany({
        where: {
          NOT: { userId: session.id },
          OR: [
            { status: "submitted", firstApproverId: session.id },
            { status: "first_approved", secondApproverId: session.id },
          ],
        },
        include: { user: { select: { name: true } } },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      })
    : [];

  return (
    <div>
      <PageHeader title="月次勤怠" description="月次勤怠の確定申請と電子承認を行います。" />

      <SectionCard title="自分の月次勤怠">
        {mine.length === 0 ? (
          <EmptyState message="月次勤怠データがありません。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>対象年月</th>
                  <th>出勤日数</th>
                  <th>総労働</th>
                  <th>残業</th>
                  <th>状態</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mine.map((c) => (
                  <tr key={c.id}>
                    <td>{c.year}年{c.month}月</td>
                    <td>{c.attendanceDays}日</td>
                    <td>{minutesToHHMM(c.totalWorkMinutes)}</td>
                    <td>{minutesToHHMM(c.overtimeMinutes)}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td><Link href={`/monthly/${c.id}`} className="text-sm text-[var(--accent)]">確認</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {isApprover(session.role) && (
        <div className="mt-6">
          <SectionCard title="承認待ちの月次勤怠">
            {awaiting.length === 0 ? (
              <EmptyState message="承認待ちの月次勤怠はありません。" />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>対象者</th>
                      <th>対象年月</th>
                      <th>残業</th>
                      <th>状態</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {awaiting.map((c) => (
                      <tr key={c.id}>
                        <td>{c.user.name}</td>
                        <td>{c.year}年{c.month}月</td>
                        <td>{minutesToHHMM(c.overtimeMinutes)}</td>
                        <td><StatusBadge status={c.status} /></td>
                        <td><Link href={`/monthly/${c.id}`} className="btn btn-accent px-3 py-1 text-xs">承認する</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
