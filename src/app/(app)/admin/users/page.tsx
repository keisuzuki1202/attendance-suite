import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { UsersAdmin } from "@/components/UsersAdmin";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const [users, departments, employmentTypes] = await Promise.all([
    prisma.user.findMany({ orderBy: { employeeCode: "asc" } }),
    prisma.department.findMany({ orderBy: { code: "asc" } }),
    prisma.employmentType.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="従業員マスタ" description="従業員情報・ロール・レポートライン（承認者）を管理します。" />
      <UsersAdmin
        users={users.map((u) => ({
          id: u.id,
          employeeCode: u.employeeCode,
          name: u.name,
          email: u.email,
          role: u.role,
          departmentId: u.departmentId,
          employmentTypeId: u.employmentTypeId,
          firstApproverId: u.firstApproverId,
          secondApproverId: u.secondApproverId,
          isActive: u.isActive,
        }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        employmentTypes={employmentTypes.map((e) => ({ id: e.id, name: e.name }))}
      />
    </div>
  );
}
