import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { MastersAdmin } from "@/components/MastersAdmin";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const [departments, employmentTypes, workTypes] = await Promise.all([
    prisma.department.findMany({ orderBy: { code: "asc" } }),
    prisma.employmentType.findMany({ orderBy: { code: "asc" } }),
    prisma.workType.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="マスタ設定"
        description="部門・雇用区分・勤務区分（休日区分含む）を管理します。通知設定はアプリ内＋メールが既定です。"
      />
      <MastersAdmin
        departments={departments}
        employmentTypes={employmentTypes}
        workTypes={workTypes.map((w) => ({ id: w.id, code: w.code, name: w.name, isHoliday: w.isHoliday }))}
      />
    </div>
  );
}
