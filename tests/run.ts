/* 簡易テストランナー（tsx で実行: npm test）
   単体テスト: 勤怠計算 / RBAC / バリデーション
   結合テスト: DB(seed) の整合性・承認フローの状態整合 */
import path from "node:path";
import assert from "node:assert";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { calcAttendance, calcNightMinutes, minutesToHHMM, isLateStart } from "../src/lib/attendance";
import { can, canActOnApplication, isApprover } from "../src/lib/rbac";
import { applicationCreateSchema } from "../src/lib/validation";

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

async function main() {
  console.log("\n[単体] 勤怠計算");
  await test("所定内 9:00-17:30 休憩60 → 実働7.5h 残業0（17:30以降が時間外）", () => {
    const r = calcAttendance({
      clockIn: new Date(2026, 5, 1, 9, 0),
      clockOut: new Date(2026, 5, 1, 17, 30),
      breakMinutes: 60,
    });
    assert.strictEqual(r.workMinutes, 450);
    assert.strictEqual(r.overtimeMinutes, 0);
  });
  await test("残業 9:00-20:00 → 17:30以降の150分が時間外", () => {
    const r = calcAttendance({
      clockIn: new Date(2026, 5, 1, 9, 0),
      clockOut: new Date(2026, 5, 1, 20, 0),
      breakMinutes: 60,
    });
    assert.strictEqual(r.workMinutes, 600);
    assert.strictEqual(r.overtimeMinutes, 150);
  });
  await test("18:00退勤 → 時間外30分", () => {
    const r = calcAttendance({
      clockIn: new Date(2026, 5, 1, 9, 0),
      clockOut: new Date(2026, 5, 1, 18, 0),
      breakMinutes: 60,
    });
    assert.strictEqual(r.overtimeMinutes, 30);
  });
  await test("遅刻判定: 9:00は遅刻でない / 9:01は遅刻（打刻修正が必要）", () => {
    assert.strictEqual(isLateStart(new Date(2026, 5, 1, 9, 0)), false);
    assert.strictEqual(isLateStart(new Date(2026, 5, 1, 9, 1)), true);
    assert.strictEqual(isLateStart(new Date(2026, 5, 1, 8, 55)), false);
  });
  await test("深夜帯 22:00-24:00 → 120分", () => {
    const n = calcNightMinutes(new Date(2026, 5, 1, 22, 0), new Date(2026, 5, 2, 0, 0));
    assert.strictEqual(n, 120);
  });
  await test("退勤<出勤 は0扱い", () => {
    const r = calcAttendance({
      clockIn: new Date(2026, 5, 1, 18, 0),
      clockOut: new Date(2026, 5, 1, 9, 0),
      breakMinutes: 60,
    });
    assert.strictEqual(r.workMinutes, 0);
  });
  await test("minutesToHHMM(125) === '2:05'", () => {
    assert.strictEqual(minutesToHHMM(125), "2:05");
  });

  console.log("\n[単体] RBAC / 内部統制");
  await test("従業員は管理者設定不可", () => {
    assert.strictEqual(can("employee", "admin_settings"), false);
  });
  await test("管理者は管理者設定可", () => {
    assert.strictEqual(can("admin", "admin_settings"), true);
  });
  await test("産業医は申請不可・閲覧のみ", () => {
    assert.strictEqual(can("occupational_physician", "apply"), false);
    assert.strictEqual(can("occupational_physician", "physician_view"), true);
  });
  await test("承認者本人は自分の申請を承認できない", () => {
    assert.strictEqual(
      canActOnApplication({ actorId: "u1", applicantId: "u1", role: "first_approver" }),
      false,
    );
    assert.strictEqual(
      canActOnApplication({ actorId: "u2", applicantId: "u1", role: "first_approver" }),
      true,
    );
  });
  await test("isApprover 判定", () => {
    assert.strictEqual(isApprover("first_approver"), true);
    assert.strictEqual(isApprover("employee"), false);
  });

  console.log("\n[単体] バリデーション");
  await test("有給申請: 予測効果・該当日時が必須", () => {
    const r = applicationCreateSchema.safeParse({
      applicationType: "paid_leave",
      title: "x",
      content: "y",
    });
    assert.strictEqual(r.success, false);
  });
  await test("打刻修正: 理由・対象が必須", () => {
    const r = applicationCreateSchema.safeParse({
      applicationType: "correction",
      title: "x",
      content: "y",
    });
    assert.strictEqual(r.success, false);
  });
  await test("有給申請: 必須を満たせば成功", () => {
    const r = applicationCreateSchema.safeParse({
      applicationType: "paid_leave",
      title: "有給",
      content: "私用",
      expectedEffect: "リフレッシュ",
      targetStartAt: "2026-07-01T00:00",
    });
    assert.strictEqual(r.success, true);
  });

  // ---- 結合テスト（seed DB 読み取り） ----
  const adapter = new PrismaLibSql({
    url: `file:${path.join(process.cwd(), "dev.db").replace(/\\/g, "/")}`,
  });
  const prisma = new PrismaClient({ adapter });

  console.log("\n[結合] DB整合性");
  await test("ユーザーが6名以上 seed されている", async () => {
    const c = await prisma.user.count();
    assert.ok(c >= 6, `users=${c}`);
  });
  await test("全ロールが存在する", async () => {
    for (const role of ["employee", "first_approver", "second_approver", "admin", "occupational_physician"]) {
      const c = await prisma.user.count({ where: { role } });
      assert.ok(c >= 1, `role ${role} missing`);
    }
  });
  await test("提出済み申請には必ず2件の承認ステップがある", async () => {
    const apps = await prisma.application.findMany({
      where: { status: { not: "draft" } },
      include: { approvalSteps: true },
    });
    for (const a of apps) {
      assert.strictEqual(a.approvalSteps.length, 2, `app ${a.id} steps=${a.approvalSteps.length}`);
    }
  });
  await test("承認完了申請は currentStepLevel=0", async () => {
    const apps = await prisma.application.findMany({ where: { status: "second_approved" } });
    for (const a of apps) assert.strictEqual(a.currentStepLevel, 0);
  });
  await test("PCログは監査として記録されている", async () => {
    const c = await prisma.pcActivityLog.count();
    assert.ok(c > 0, "no pc logs");
  });
  await test("監査ログが記録されている", async () => {
    const c = await prisma.auditLog.count();
    assert.ok(c > 0, "no audit logs");
  });

  await prisma.$disconnect();

  console.log(`\n結果: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
