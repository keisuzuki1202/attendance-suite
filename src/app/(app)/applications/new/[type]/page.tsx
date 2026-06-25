import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { ApplicationForm, type ApplicationFormValues } from "@/components/ApplicationForm";
import { APPLICATION_TYPE_LABELS } from "@/lib/constants";
import { toDatetimeLocal, fmtDate } from "@/lib/attendance";

const VALID = ["paid_leave", "training", "business_trip", "correction"];

interface OptionRec {
  id: string;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
}

export default async function NewApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ recordId?: string }>;
}) {
  const { type } = await params;
  if (!VALID.includes(type)) notFound();
  const session = await getSession();
  if (!session) redirect("/login");
  const { recordId } = await searchParams;

  const workTypes = await prisma.workType.findMany({ orderBy: { code: "asc" } });

  let attendanceOptions: OptionRec[] = [];
  let initialValues: Partial<ApplicationFormValues> | undefined;

  if (type === "correction") {
    const recs = await prisma.attendanceRecord.findMany({
      where: { userId: session.id, locked: false },
      orderBy: { workDate: "desc" },
      take: 30,
    });
    attendanceOptions = recs.map((r) => ({
      id: r.id,
      workDate: r.workDate.toISOString(),
      clockIn: r.clockIn?.toISOString() ?? null,
      clockOut: r.clockOut?.toISOString() ?? null,
      breakMinutes: r.breakMinutes,
    }));

    // 要確認の日などから対象勤怠を指定された場合は、既存の打刻情報を事前反映
    if (recordId) {
      const target = await prisma.attendanceRecord.findUnique({
        where: { id: recordId },
      });
      if (target && target.userId === session.id && !target.locked) {
        // 一覧に無ければ先頭へ追加
        if (!attendanceOptions.some((o) => o.id === target.id)) {
          attendanceOptions.unshift({
            id: target.id,
            workDate: target.workDate.toISOString(),
            clockIn: target.clockIn?.toISOString() ?? null,
            clockOut: target.clockOut?.toISOString() ?? null,
            breakMinutes: target.breakMinutes,
          });
        }
        initialValues = {
          title: `打刻修正申請（${fmtDate(target.workDate)}）`,
          attendanceRecordId: target.id,
          afterClockIn: toDatetimeLocal(target.clockIn),
          afterClockOut: toDatetimeLocal(target.clockOut),
          afterBreakMinutes: target.breakMinutes,
          afterWorkTypeId: target.workTypeId ?? "",
        };
      }
    }
  }

  return (
    <div>
      <PageHeader
        title={`${APPLICATION_TYPE_LABELS[type]}申請`}
        description="必要事項を入力して申請してください。3クリック以内で完了します。"
      />
      <ApplicationForm
        type={type}
        attendanceOptions={attendanceOptions}
        workTypes={workTypes.map((w) => ({ id: w.id, name: w.name }))}
        initialValues={initialValues}
      />
    </div>
  );
}
