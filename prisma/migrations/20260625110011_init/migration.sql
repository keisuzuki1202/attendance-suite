-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeCode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'employee',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT,
    "employmentTypeId" TEXT,
    "firstApproverId" TEXT,
    "secondApproverId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_employmentTypeId_fkey" FOREIGN KEY ("employmentTypeId") REFERENCES "employment_types" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_firstApproverId_fkey" FOREIGN KEY ("firstApproverId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_secondApproverId_fkey" FOREIGN KEY ("secondApproverId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "employment_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "work_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workDate" DATETIME NOT NULL,
    "clockIn" DATETIME,
    "clockOut" DATETIME,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "workTypeId" TEXT,
    "workMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "nightMinutes" INTEGER NOT NULL DEFAULT 0,
    "isHolidayWork" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "status" TEXT NOT NULL DEFAULT 'unconfirmed',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "attendance_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "attendance_records_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "work_types" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pc_activity_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pc_activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationType" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetStartAt" DATETIME,
    "targetEndAt" DATETIME,
    "content" TEXT NOT NULL,
    "expectedEffect" TEXT,
    "attachmentPath" TEXT,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentStepLevel" INTEGER NOT NULL DEFAULT 0,
    "resubmitCount" INTEGER NOT NULL DEFAULT 0,
    "firstApproverId" TEXT,
    "secondApproverId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "applications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "correction_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "beforeClockIn" DATETIME,
    "afterClockIn" DATETIME,
    "beforeClockOut" DATETIME,
    "afterClockOut" DATETIME,
    "beforeBreakMinutes" INTEGER,
    "afterBreakMinutes" INTEGER,
    "beforeWorkTypeId" TEXT,
    "afterWorkTypeId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "correction_requests_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "correction_requests_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "attendance_records" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "correction_requests_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "application_approval_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "stepLevel" INTEGER NOT NULL,
    "approverId" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_approval_steps_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "application_approval_steps_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'comment',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_comments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "approval_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "relatedApplicationId" TEXT,
    "emailSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "notifications_relatedApplicationId_fkey" FOREIGN KEY ("relatedApplicationId") REFERENCES "applications" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "paid_leave_balances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "grantedDays" REAL NOT NULL DEFAULT 0,
    "usedDays" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "paid_leave_balances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "monthly_attendance_closings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "attendanceDays" INTEGER NOT NULL DEFAULT 0,
    "totalWorkMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "nightMinutes" INTEGER NOT NULL DEFAULT 0,
    "holidayWorkDays" INTEGER NOT NULL DEFAULT 0,
    "paidLeaveDays" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "firstApproverId" TEXT,
    "secondApproverId" TEXT,
    "submittedAt" DATETIME,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "monthly_attendance_closings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "monthly_approval_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "closingId" TEXT NOT NULL,
    "stepLevel" INTEGER NOT NULL,
    "approverId" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "monthly_approval_logs_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "monthly_attendance_closings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "monthly_approval_logs_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "occupational_health_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "generatedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "note" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sharedAt" DATETIME,
    CONSTRAINT "occupational_health_reports_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "occupational_health_report_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "totalWorkMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "nightMinutes" INTEGER NOT NULL DEFAULT 0,
    "holidayWorkDays" INTEGER NOT NULL DEFAULT 0,
    "paidLeaveDays" REAL NOT NULL DEFAULT 0,
    "over45" BOOLEAN NOT NULL DEFAULT false,
    "over80" BOOLEAN NOT NULL DEFAULT false,
    "interviewCandidate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occupational_health_report_items_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "occupational_health_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "occupational_health_report_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "occupational_health_report_items_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "occupational_physician_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportItemId" TEXT NOT NULL,
    "physicianId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occupational_physician_comments_reportItemId_fkey" FOREIGN KEY ("reportItemId") REFERENCES "occupational_health_report_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "occupational_physician_comments_physicianId_fkey" FOREIGN KEY ("physicianId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "medical_review_statuses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportItemId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedByPhysicianId" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "medical_review_statuses_reportItemId_fkey" FOREIGN KEY ("reportItemId") REFERENCES "occupational_health_report_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "labor_risk_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "labor_risk_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeCode_key" ON "users"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employment_types_code_key" ON "employment_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "work_types_code_key" ON "work_types"("code");

-- CreateIndex
CREATE INDEX "attendance_records_userId_idx" ON "attendance_records"("userId");

-- CreateIndex
CREATE INDEX "attendance_records_workDate_idx" ON "attendance_records"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_userId_workDate_key" ON "attendance_records"("userId", "workDate");

-- CreateIndex
CREATE INDEX "pc_activity_logs_userId_occurredAt_idx" ON "pc_activity_logs"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "pc_activity_logs_eventType_idx" ON "pc_activity_logs"("eventType");

-- CreateIndex
CREATE INDEX "applications_applicantId_idx" ON "applications"("applicantId");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "applications_applicationType_idx" ON "applications"("applicationType");

-- CreateIndex
CREATE UNIQUE INDEX "correction_requests_applicationId_key" ON "correction_requests"("applicationId");

-- CreateIndex
CREATE INDEX "correction_requests_attendanceRecordId_idx" ON "correction_requests"("attendanceRecordId");

-- CreateIndex
CREATE INDEX "application_approval_steps_applicationId_idx" ON "application_approval_steps"("applicationId");

-- CreateIndex
CREATE INDEX "application_approval_steps_approverId_decision_idx" ON "application_approval_steps"("approverId", "decision");

-- CreateIndex
CREATE INDEX "approval_comments_applicationId_idx" ON "approval_comments"("applicationId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "paid_leave_balances_userId_fiscalYear_key" ON "paid_leave_balances"("userId", "fiscalYear");

-- CreateIndex
CREATE INDEX "monthly_attendance_closings_status_idx" ON "monthly_attendance_closings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_attendance_closings_userId_year_month_key" ON "monthly_attendance_closings"("userId", "year", "month");

-- CreateIndex
CREATE INDEX "monthly_approval_logs_closingId_idx" ON "monthly_approval_logs"("closingId");

-- CreateIndex
CREATE UNIQUE INDEX "occupational_health_reports_year_month_key" ON "occupational_health_reports"("year", "month");

-- CreateIndex
CREATE INDEX "occupational_health_report_items_userId_idx" ON "occupational_health_report_items"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "occupational_health_report_items_reportId_userId_key" ON "occupational_health_report_items"("reportId", "userId");

-- CreateIndex
CREATE INDEX "occupational_physician_comments_reportItemId_idx" ON "occupational_physician_comments"("reportItemId");

-- CreateIndex
CREATE UNIQUE INDEX "medical_review_statuses_reportItemId_key" ON "medical_review_statuses"("reportItemId");

-- CreateIndex
CREATE INDEX "labor_risk_alerts_userId_idx" ON "labor_risk_alerts"("userId");

-- CreateIndex
CREATE INDEX "labor_risk_alerts_alertType_isResolved_idx" ON "labor_risk_alerts"("alertType", "isResolved");
