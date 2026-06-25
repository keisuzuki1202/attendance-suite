import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { calcAttendance, isLateStart } from "../src/lib/attendance";

const adapter = new PrismaLibSql({
  url: `file:${path.join(process.cwd(), "dev.db").replace(/\\/g, "/")}`,
});
const prisma = new PrismaClient({ adapter });

const PASSWORD = "Password123!";

async function reset() {
  // 依存関係の逆順で全削除（再実行可能にする）
  await prisma.occupationalPhysicianComment.deleteMany();
  await prisma.medicalReviewStatus.deleteMany();
  await prisma.occupationalHealthReportItem.deleteMany();
  await prisma.occupationalHealthReport.deleteMany();
  await prisma.laborRiskAlert.deleteMany();
  await prisma.monthlyApprovalLog.deleteMany();
  await prisma.monthlyAttendanceClosing.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.approvalComment.deleteMany();
  await prisma.applicationApprovalStep.deleteMany();
  await prisma.correctionRequest.deleteMany();
  await prisma.application.deleteMany();
  await prisma.pcActivityLog.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.paidLeaveBalance.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workType.deleteMany();
  await prisma.employmentType.deleteMany();
  await prisma.department.deleteMany();
}

async function main() {
  console.log("Seeding...");
  await reset();
  const hash = await bcrypt.hash(PASSWORD, 10);

  // --- マスタ ---
  const [sales, dev, admin] = await Promise.all([
    prisma.department.create({ data: { code: "SALES", name: "営業部" } }),
    prisma.department.create({ data: { code: "DEV", name: "開発部" } }),
    prisma.department.create({ data: { code: "ADMIN", name: "管理部" } }),
  ]);

  const [full, contract, part] = await Promise.all([
    prisma.employmentType.create({ data: { code: "FULL", name: "正社員" } }),
    prisma.employmentType.create({ data: { code: "CONTRACT", name: "契約社員" } }),
    prisma.employmentType.create({ data: { code: "PART", name: "パート" } }),
  ]);

  const workTypes = await Promise.all([
    prisma.workType.create({ data: { code: "NORMAL", name: "通常勤務" } }),
    prisma.workType.create({ data: { code: "REMOTE", name: "在宅勤務" } }),
    prisma.workType.create({ data: { code: "TRIP", name: "出張" } }),
    prisma.workType.create({ data: { code: "HOLIDAY", name: "休日出勤", isHoliday: true } }),
    prisma.workType.create({ data: { code: "HALF", name: "半休" } }),
    prisma.workType.create({ data: { code: "PAID", name: "有給休暇" } }),
  ]);
  const wtNormal = workTypes[0];
  const wtPaid = workTypes[5];

  // --- ユーザー（レポートライン設定） ---
  const adminUser = await prisma.user.create({
    data: {
      employeeCode: "E0001",
      email: "admin@example.com",
      passwordHash: hash,
      name: "管理 太郎",
      role: "admin",
      departmentId: admin.id,
      employmentTypeId: full.id,
    },
  });

  const physician = await prisma.user.create({
    data: {
      employeeCode: "E0002",
      email: "doctor@example.com",
      passwordHash: hash,
      name: "産業 医子",
      role: "occupational_physician",
      departmentId: admin.id,
      employmentTypeId: contract.id,
    },
  });

  const bucho = await prisma.user.create({
    data: {
      employeeCode: "E0003",
      email: "bucho@example.com",
      passwordHash: hash,
      name: "部長 次郎",
      role: "second_approver",
      departmentId: sales.id,
      employmentTypeId: full.id,
      firstApproverId: adminUser.id,
    },
  });

  const kacho = await prisma.user.create({
    data: {
      employeeCode: "E0004",
      email: "kacho@example.com",
      passwordHash: hash,
      name: "課長 一郎",
      role: "first_approver",
      departmentId: sales.id,
      employmentTypeId: full.id,
      firstApproverId: bucho.id,
      secondApproverId: adminUser.id,
    },
  });

  const hanako = await prisma.user.create({
    data: {
      employeeCode: "E0005",
      email: "hanako@example.com",
      passwordHash: hash,
      name: "社員 花子",
      role: "employee",
      departmentId: sales.id,
      employmentTypeId: full.id,
      firstApproverId: kacho.id,
      secondApproverId: bucho.id,
    },
  });

  const kenta = await prisma.user.create({
    data: {
      employeeCode: "E0006",
      email: "kenta@example.com",
      passwordHash: hash,
      name: "社員 健太",
      role: "employee",
      departmentId: dev.id,
      employmentTypeId: full.id,
      firstApproverId: kacho.id,
      secondApproverId: bucho.id,
    },
  });

  const employees = [hanako, kenta];

  // --- 有給残数 ---
  for (const u of [...employees, kacho]) {
    await prisma.paidLeaveBalance.create({
      data: { userId: u.id, fiscalYear: 2026, grantedDays: 20, usedDays: 3 },
    });
  }

  // --- 勤怠 + PCログ（当月の平日、本日まで） ---
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const wtTrip = workTypes[2]; // 出張

  // hanako の当月パターン（平日通算番号で割当）
  //  ・要確認(09:00より後の出勤): 5日   ・有給取得: 1日   ・国内出張: 2日   ・他: 定時(09:00)
  const HANAKO_LATE = new Set([1, 3, 5, 7, 9]); // 5日 要確認
  const HANAKO_TRIP = new Set([11, 12]); // 2日 国内出張
  const HANAKO_PAID = 14; // 1日 有給取得
  let hanakoPaidDate: Date | null = null;
  const hanakoTripDates: Date[] = [];

  for (const u of employees) {
    let weekdayIdx = 0;
    for (let day = 1; day <= today.getDate(); day++) {
      const d = new Date(year, month, day);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // 土日除外
      weekdayIdx += 1;
      const workDate = new Date(year, month, day, 0, 0, 0, 0);

      let clockIn: Date;
      let clockOut: Date;
      let workTypeId = wtNormal.id;

      if (u.id === hanako.id) {
        // 有給取得日は休暇レコード（打刻なし・区分=有給休暇）として作成
        if (weekdayIdx === HANAKO_PAID) {
          hanakoPaidDate = workDate;
          await prisma.attendanceRecord.create({
            data: {
              userId: u.id,
              workDate,
              clockIn: null,
              clockOut: null,
              breakMinutes: 0,
              workTypeId: wtPaid.id,
              source: "manual",
              status: "normal",
              note: "有給休暇取得",
            },
          });
          continue;
        }
        const late = HANAKO_LATE.has(weekdayIdx);
        const isTrip = HANAKO_TRIP.has(weekdayIdx);
        clockIn = new Date(year, month, day, 9, late ? 6 : 0, 0); // 要確認日のみ09:06
        clockOut = new Date(year, month, day, 18, isTrip ? 30 : 5, 0);
        if (isTrip) {
          workTypeId = wtTrip.id;
          hanakoTripDates.push(workDate);
        }
      } else {
        // 健太は定時(09:00)始業。一部の日は長時間（残業）で産業医アラート対象に。
        clockIn = new Date(year, month, day, 9, 0, 0);
        const long = day % 3 === 0;
        clockOut = new Date(year, month, day, long ? 22 : 18, long ? 30 : 15, 0);
      }

      const calc = calcAttendance({ clockIn, clockOut, breakMinutes: 60 });
      await prisma.attendanceRecord.create({
        data: {
          userId: u.id,
          workDate,
          clockIn,
          clockOut,
          breakMinutes: 60,
          workTypeId,
          source: "auto",
          // 09:00より後の出勤打刻は要確認（打刻修正が必要）
          status: isLateStart(clockIn) ? "needs_review" : "normal",
          ...calc,
        },
      });
      await prisma.pcActivityLog.create({
        data: {
          userId: u.id,
          terminalId: `PC-${u.employeeCode}`,
          eventType: "startup",
          occurredAt: clockIn,
          ipAddress: "192.168.10." + (10 + day),
          rawPayload: JSON.stringify({ event: "startup", auto: true }),
        },
      });
      await prisma.pcActivityLog.create({
        data: {
          userId: u.id,
          terminalId: `PC-${u.employeeCode}`,
          eventType: "shutdown",
          occurredAt: clockOut,
          ipAddress: "192.168.10." + (10 + day),
          rawPayload: JSON.stringify({ event: "shutdown", auto: true }),
        },
      });
    }
  }

  // --- 申請（各ステータスのサンプル） ---
  // 1) 有給：申請中（1次待ち）
  const app1 = await prisma.application.create({
    data: {
      applicationType: "paid_leave",
      applicantId: hanako.id,
      title: "有給休暇申請",
      targetStartAt: new Date(year, month, today.getDate() + 5, 0, 0, 0),
      targetEndAt: new Date(year, month, today.getDate() + 5, 23, 59, 0),
      content: "私用のため終日休暇を取得します。",
      expectedEffect: "リフレッシュによる業務効率向上",
      status: "submitted",
      currentStepLevel: 1,
      firstApproverId: kacho.id,
      secondApproverId: bucho.id,
      submittedAt: new Date(),
      approvalSteps: {
        create: [
          { stepLevel: 1, approverId: kacho.id, decision: "pending" },
          { stepLevel: 2, approverId: bucho.id, decision: "pending" },
        ],
      },
    },
  });

  // 2) 出張：1次承認済み（2次待ち）
  const app2 = await prisma.application.create({
    data: {
      applicationType: "business_trip",
      applicantId: hanako.id,
      title: "出張申請（九州代理店訪問）",
      tripType: "domestic",
      targetStartAt: new Date(year, month + 1, 1),
      targetEndAt: new Date(year, month + 1, 3),
      content: "九州代理店訪問および販売チャネル開拓のため出張します。",
      expectedEffect: "新規販売チャネルの開拓",
      status: "first_approved",
      currentStepLevel: 2,
      firstApproverId: kacho.id,
      secondApproverId: bucho.id,
      submittedAt: new Date(Date.now() - 86400000),
      approvalSteps: {
        create: [
          {
            stepLevel: 1,
            approverId: kacho.id,
            decision: "approved",
            comment: "問題ありません。",
            decidedAt: new Date(Date.now() - 43200000),
          },
          { stepLevel: 2, approverId: bucho.id, decision: "pending" },
        ],
      },
    },
  });

  // 3) 研修：承認完了
  const app3 = await prisma.application.create({
    data: {
      applicationType: "training",
      applicantId: kenta.id,
      title: "研修受講申請（TypeScript研修）",
      targetStartAt: new Date(year, month, today.getDate() + 2),
      targetEndAt: new Date(year, month, today.getDate() + 2, 18, 0),
      content: "TypeScript実践研修を受講します。",
      expectedEffect: "開発生産性とコード品質の向上",
      status: "second_approved",
      currentStepLevel: 0,
      firstApproverId: kacho.id,
      secondApproverId: bucho.id,
      submittedAt: new Date(Date.now() - 172800000),
      completedAt: new Date(Date.now() - 86400000),
      approvalSteps: {
        create: [
          {
            stepLevel: 1,
            approverId: kacho.id,
            decision: "approved",
            comment: "承認します。",
            decidedAt: new Date(Date.now() - 129600000),
          },
          {
            stepLevel: 2,
            approverId: bucho.id,
            decision: "approved",
            comment: "問題なし。",
            decidedAt: new Date(Date.now() - 86400000),
          },
        ],
      },
    },
  });

  // 4) 打刻修正：1次差戻し
  const someRecord = await prisma.attendanceRecord.findFirst({
    where: { userId: hanako.id },
    orderBy: { workDate: "asc" },
  });
  const app4 = await prisma.application.create({
    data: {
      applicationType: "correction",
      applicantId: hanako.id,
      title: "打刻修正申請",
      content: "退勤打刻が自動取得できなかったため修正します。",
      status: "first_rejected",
      currentStepLevel: 1,
      firstApproverId: kacho.id,
      secondApproverId: bucho.id,
      submittedAt: new Date(Date.now() - 259200000),
      approvalSteps: {
        create: [
          {
            stepLevel: 1,
            approverId: kacho.id,
            decision: "rejected",
            comment: "修正理由をより具体的に記載してください。",
            decidedAt: new Date(Date.now() - 200000000),
          },
          { stepLevel: 2, approverId: bucho.id, decision: "pending" },
        ],
      },
    },
  });
  if (someRecord) {
    await prisma.correctionRequest.create({
      data: {
        applicationId: app4.id,
        attendanceRecordId: someRecord.id,
        applicantId: hanako.id,
        beforeClockOut: someRecord.clockOut,
        afterClockOut: new Date(
          someRecord.workDate.getFullYear(),
          someRecord.workDate.getMonth(),
          someRecord.workDate.getDate(),
          19,
          0,
        ),
        beforeBreakMinutes: someRecord.breakMinutes,
        afterBreakMinutes: 60,
        reason: "退勤打刻漏れのため",
      },
    });
  }

  // 5) 当月の有給取得（承認完了）— 勤怠は休暇のためレコードなし
  if (hanakoPaidDate) {
    await prisma.application.create({
      data: {
        applicationType: "paid_leave",
        applicantId: hanako.id,
        title: "有給休暇申請（取得済み）",
        targetStartAt: hanakoPaidDate,
        targetEndAt: new Date(
          hanakoPaidDate.getFullYear(),
          hanakoPaidDate.getMonth(),
          hanakoPaidDate.getDate(),
          23,
          59,
        ),
        content: "私用のため終日休暇を取得しました。",
        expectedEffect: "リフレッシュによる業務効率向上",
        status: "second_approved",
        currentStepLevel: 0,
        firstApproverId: kacho.id,
        secondApproverId: bucho.id,
        submittedAt: new Date(hanakoPaidDate.getTime() - 5 * 86400000),
        completedAt: new Date(hanakoPaidDate.getTime() - 3 * 86400000),
        approvalSteps: {
          create: [
            { stepLevel: 1, approverId: kacho.id, decision: "approved", decidedAt: new Date(hanakoPaidDate.getTime() - 4 * 86400000) },
            { stepLevel: 2, approverId: bucho.id, decision: "approved", decidedAt: new Date(hanakoPaidDate.getTime() - 3 * 86400000) },
          ],
        },
      },
    });
  }

  // 6) 当月の国内出張（承認完了）— 2日分
  if (hanakoTripDates.length > 0) {
    const tripStart = hanakoTripDates[0];
    const tripEnd = hanakoTripDates[hanakoTripDates.length - 1];
    await prisma.application.create({
      data: {
        applicationType: "business_trip",
        applicantId: hanako.id,
        title: "出張申請（国内・取引先往訪）",
        tripType: "domestic",
        targetStartAt: tripStart,
        targetEndAt: new Date(
          tripEnd.getFullYear(),
          tripEnd.getMonth(),
          tripEnd.getDate(),
          18,
          0,
        ),
        content: "国内取引先への往訪および打合せのため出張しました。",
        expectedEffect: "取引継続および新規案件の獲得",
        status: "second_approved",
        currentStepLevel: 0,
        firstApproverId: kacho.id,
        secondApproverId: bucho.id,
        submittedAt: new Date(tripStart.getTime() - 6 * 86400000),
        completedAt: new Date(tripStart.getTime() - 3 * 86400000),
        approvalSteps: {
          create: [
            { stepLevel: 1, approverId: kacho.id, decision: "approved", decidedAt: new Date(tripStart.getTime() - 5 * 86400000) },
            { stepLevel: 2, approverId: bucho.id, decision: "approved", decidedAt: new Date(tripStart.getTime() - 3 * 86400000) },
          ],
        },
      },
    });
  }

  // --- 通知 ---
  await prisma.notification.createMany({
    data: [
      {
        userId: kacho.id,
        type: "approval_request",
        title: "承認依頼: 有給休暇申請",
        body: "社員 花子 さんから有給休暇申請が提出されました。",
        relatedApplicationId: app1.id,
        linkUrl: `/approvals/${app1.id}`,
      },
      {
        userId: bucho.id,
        type: "approval_request",
        title: "承認依頼: 出張申請",
        body: "1次承認が完了しました。2次承認をお願いします。",
        relatedApplicationId: app2.id,
        linkUrl: `/approvals/${app2.id}`,
      },
      {
        userId: hanako.id,
        type: "rejected",
        title: "差戻し: 打刻修正申請",
        body: "1次承認者より差戻されました。内容を確認し再申請してください。",
        relatedApplicationId: app4.id,
        isRead: false,
        linkUrl: `/applications/${app4.id}`,
      },
      {
        userId: kenta.id,
        type: "second_approved",
        title: "承認完了: 研修受講申請",
        body: "研修受講申請が承認完了しました。",
        relatedApplicationId: app3.id,
        isRead: true,
        readAt: new Date(),
        linkUrl: `/applications/${app3.id}`,
      },
    ],
  });

  // --- 月次確定（前月: 承認完了+ロック / 当月: open） ---
  const prevMonthDate = new Date(year, month - 1, 1);
  for (const u of employees) {
    await prisma.monthlyAttendanceClosing.create({
      data: {
        userId: u.id,
        year: prevMonthDate.getFullYear(),
        month: prevMonthDate.getMonth() + 1,
        attendanceDays: 20,
        totalWorkMinutes: 20 * 8 * 60 + (u.id === kenta.id ? 50 * 60 : 12 * 60),
        overtimeMinutes: u.id === kenta.id ? 50 * 60 : 12 * 60,
        nightMinutes: u.id === kenta.id ? 8 * 60 : 0,
        holidayWorkDays: u.id === kenta.id ? 2 : 0,
        paidLeaveDays: 1,
        status: "second_approved",
        locked: true,
        firstApproverId: kacho.id,
        secondApproverId: bucho.id,
        submittedAt: prevMonthDate,
        lockedAt: new Date(),
        approvalLogs: {
          create: [
            { stepLevel: 1, approverId: kacho.id, decision: "approved", decidedAt: new Date(), comment: "確認しました。" },
            { stepLevel: 2, approverId: bucho.id, decision: "approved", decidedAt: new Date(), comment: "承認します。" },
          ],
        },
      },
    });
    await prisma.monthlyAttendanceClosing.create({
      data: {
        userId: u.id,
        year,
        month: month + 1,
        status: "open",
        firstApproverId: kacho.id,
        secondApproverId: bucho.id,
      },
    });
  }

  // --- 産業医共有レポート（前月分） ---
  const report = await prisma.occupationalHealthReport.create({
    data: {
      year: prevMonthDate.getFullYear(),
      month: prevMonthDate.getMonth() + 1,
      generatedById: adminUser.id,
      status: "shared",
      sharedAt: new Date(),
      note: "長時間労働者を中心に共有します。",
    },
  });

  // 健太は80時間未満だが45時間超 → 面談候補
  const kentaItem = await prisma.occupationalHealthReportItem.create({
    data: {
      reportId: report.id,
      userId: kenta.id,
      departmentId: dev.id,
      totalWorkMinutes: 20 * 8 * 60 + 50 * 60,
      overtimeMinutes: 50 * 60,
      nightMinutes: 8 * 60,
      holidayWorkDays: 2,
      paidLeaveDays: 1,
      over45: true,
      over80: false,
      interviewCandidate: true,
      reviewStatus: { create: { status: "shared" } },
    },
  });
  await prisma.occupationalHealthReportItem.create({
    data: {
      reportId: report.id,
      userId: hanako.id,
      departmentId: sales.id,
      totalWorkMinutes: 20 * 8 * 60 + 12 * 60,
      overtimeMinutes: 12 * 60,
      nightMinutes: 0,
      holidayWorkDays: 0,
      paidLeaveDays: 1,
      over45: false,
      over80: false,
      interviewCandidate: false,
      reviewStatus: { create: { status: "shared" } },
    },
  });

  await prisma.occupationalPhysicianComment.create({
    data: {
      reportItemId: kentaItem.id,
      physicianId: physician.id,
      body: "残業時間が増加傾向です。次月の状況を注視し、必要に応じ面談を実施します。",
    },
  });

  // --- 労務リスクアラート ---
  await prisma.laborRiskAlert.create({
    data: {
      userId: kenta.id,
      alertType: "over45",
      severity: "warning",
      year: prevMonthDate.getFullYear(),
      month: prevMonthDate.getMonth() + 1,
      message: "月45時間を超える時間外労働が発生しています。",
    },
  });

  // --- 監査ログ（サンプル） ---
  await prisma.auditLog.create({
    data: {
      actorId: kacho.id,
      action: "approve",
      entityType: "Application",
      entityId: app3.id,
      afterJson: JSON.stringify({ status: "first_approved" }),
    },
  });

  console.log("Seed completed.");
  console.log("=== ログイン情報 (共通パスワード: " + PASSWORD + ") ===");
  console.log("管理者         : admin@example.com");
  console.log("産業医         : doctor@example.com");
  console.log("2次承認者(部長): bucho@example.com");
  console.log("1次承認者(課長): kacho@example.com");
  console.log("従業員1        : hanako@example.com");
  console.log("従業員2        : kenta@example.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
