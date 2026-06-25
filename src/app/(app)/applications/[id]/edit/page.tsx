import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { ApplicationForm } from "@/components/ApplicationForm";
import { APPLICATION_TYPE_LABELS } from "@/lib/constants";
import { toDatetimeLocal } from "@/lib/attendance";

const EDITABLE = ["draft", "first_rejected", "second_rejected"];

export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const app = await prisma.application.findUnique({
    where: { id },
    include: { correctionRequest: true },
  });
  if (!app) notFound();
  if (app.applicantId !== session.id) redirect("/applications");
  if (!EDITABLE.includes(app.status)) redirect(`/applications/${id}`);

  const workTypes = await prisma.workType.findMany({ orderBy: { code: "asc" } });

  let attendanceOptions: {
    id: string;
    workDate: string;
    clockIn: string | null;
    clockOut: string | null;
    breakMinutes: number;
  }[] = [];
  if (app.applicationType === "correction") {
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
  }

  const cr = app.correctionRequest;
  const initialValues = {
    title: app.title,
    content: app.content,
    expectedEffect: app.expectedEffect ?? "",
    targetStartAt: toDatetimeLocal(app.targetStartAt),
    targetEndAt: toDatetimeLocal(app.targetEndAt),
    comment: app.comment ?? "",
    attachmentPath: app.attachmentPath ?? "",
    tripType: app.tripType ?? "domestic",
    attendanceRecordId: cr?.attendanceRecordId ?? "",
    afterClockIn: toDatetimeLocal(cr?.afterClockIn),
    afterClockOut: toDatetimeLocal(cr?.afterClockOut),
    afterBreakMinutes: cr?.afterBreakMinutes ?? 60,
    afterWorkTypeId: cr?.afterWorkTypeId ?? "",
    reason: cr?.reason ?? "",
  };

  const isRejected = app.status !== "draft";

  return (
    <div>
      <PageHeader
        title={`${APPLICATION_TYPE_LABELS[app.applicationType]}申請の編集`}
        description={
          isRejected
            ? "差戻し内容を踏まえて加筆・修正のうえ、再申請してください。"
            : "内容を編集して提出してください。"
        }
      />
      <ApplicationForm
        type={app.applicationType}
        editId={app.id}
        status={app.status}
        initialValues={initialValues}
        attendanceOptions={attendanceOptions}
        workTypes={workTypes.map((w) => ({ id: w.id, name: w.name }))}
      />
    </div>
  );
}
