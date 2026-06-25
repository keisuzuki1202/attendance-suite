import { z } from "zod";

export const applicationTypeEnum = z.enum([
  "paid_leave",
  "training",
  "business_trip",
  "correction",
]);

// 申請の必須項目 (要件3.3): 申請種別/該当日時/内容/予測効果（添付・コメントは任意）
export const applicationCreateSchema = z
  .object({
    applicationType: applicationTypeEnum,
    title: z.string().min(1, "タイトルを入力してください。").max(200),
    content: z.string().min(1, "内容を入力してください。").max(2000),
    expectedEffect: z.string().max(2000).optional().default(""),
    targetStartAt: z.string().optional().nullable(),
    targetEndAt: z.string().optional().nullable(),
    comment: z.string().max(2000).optional().nullable(),
    attachmentPath: z.string().max(500).optional().nullable(),
    tripType: z.enum(["domestic", "overseas"]).optional().nullable(),
    submit: z.boolean().optional().default(false),
    // 打刻修正用
    attendanceRecordId: z.string().optional().nullable(),
    afterClockIn: z.string().optional().nullable(),
    afterClockOut: z.string().optional().nullable(),
    afterBreakMinutes: z.number().int().min(0).max(1440).optional().nullable(),
    afterWorkTypeId: z.string().optional().nullable(),
    reason: z.string().optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.applicationType !== "correction") {
      if (!v.expectedEffect || v.expectedEffect.trim() === "") {
        ctx.addIssue({
          code: "custom",
          path: ["expectedEffect"],
          message: "予測効果を入力してください。",
        });
      }
      if (!v.targetStartAt) {
        ctx.addIssue({
          code: "custom",
          path: ["targetStartAt"],
          message: "該当日時を入力してください。",
        });
      }
    } else {
      if (!v.attendanceRecordId) {
        ctx.addIssue({
          code: "custom",
          path: ["attendanceRecordId"],
          message: "修正対象の勤怠を指定してください。",
        });
      }
      if (!v.reason || v.reason.trim() === "") {
        ctx.addIssue({
          code: "custom",
          path: ["reason"],
          message: "修正理由は必須です。",
        });
      }
    }
  });

export type ApplicationCreateInput = z.infer<typeof applicationCreateSchema>;

export const approvalActionSchema = z.object({
  comment: z.string().max(2000).optional().nullable(),
});

export const rejectActionSchema = z.object({
  comment: z.string().min(1, "差戻し理由（コメント）は必須です。").max(2000),
});

export function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
