import {
  NIGHT_END_HOUR,
  NIGHT_START_HOUR,
  SCHEDULED_END_HOUR,
  SCHEDULED_END_MINUTE,
  SCHEDULED_START_HOUR,
  SCHEDULED_START_MINUTE,
} from "./constants";

export interface AttendanceCalcInput {
  clockIn: Date | null;
  clockOut: Date | null;
  breakMinutes: number;
  isHoliday?: boolean;
}

export interface AttendanceCalcResult {
  workMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  isHolidayWork: boolean;
}

/** 出勤打刻が所定始業(09:00)より後かどうか */
export function isLateStart(clockIn: Date | null | undefined): boolean {
  if (!clockIn) return false;
  const d = new Date(clockIn);
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins > SCHEDULED_START_HOUR * 60 + SCHEDULED_START_MINUTE;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

/**
 * 深夜帯(22:00-翌5:00)に含まれる労働分を算出。
 * 区間を1分刻みではなく、当日/翌日の深夜帯と重なる範囲で計算する。
 */
export function calcNightMinutes(clockIn: Date, clockOut: Date): number {
  let total = 0;
  // 勤務開始日から終了日まで日単位で深夜帯と交差判定
  const cursor = new Date(clockIn);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(clockOut);
  while (cursor.getTime() <= end.getTime()) {
    // 当日 0:00-5:00
    const morningStart = new Date(cursor);
    morningStart.setHours(0, 0, 0, 0);
    const morningEnd = new Date(cursor);
    morningEnd.setHours(NIGHT_END_HOUR, 0, 0, 0);
    total += overlap(clockIn, clockOut, morningStart, morningEnd);

    // 当日 22:00-翌0:00
    const nightStart = new Date(cursor);
    nightStart.setHours(NIGHT_START_HOUR, 0, 0, 0);
    const nightEnd = new Date(cursor);
    nightEnd.setHours(24, 0, 0, 0);
    total += overlap(clockIn, clockOut, nightStart, nightEnd);

    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  if (end <= start) return 0;
  return Math.round((end - start) / 60000);
}

export function calcAttendance(input: AttendanceCalcInput): AttendanceCalcResult {
  const { clockIn, clockOut, breakMinutes, isHoliday } = input;
  if (!clockIn || !clockOut || clockOut <= clockIn) {
    return {
      workMinutes: 0,
      overtimeMinutes: 0,
      nightMinutes: 0,
      isHolidayWork: false,
    };
  }
  const gross = minutesBetween(clockIn, clockOut);
  const workMinutes = Math.max(0, gross - Math.max(0, breakMinutes));

  // 時間外労働 = 所定終業(17:30)以降に行われた労働
  const scheduledEnd = new Date(clockIn);
  scheduledEnd.setHours(SCHEDULED_END_HOUR, SCHEDULED_END_MINUTE, 0, 0);
  const overtimeStart = new Date(
    Math.max(clockIn.getTime(), scheduledEnd.getTime()),
  );
  const overtimeMinutes = isHoliday
    ? 0
    : Math.max(0, minutesBetween(overtimeStart, clockOut));

  const nightMinutes = calcNightMinutes(clockIn, clockOut);
  return {
    workMinutes,
    overtimeMinutes,
    nightMinutes,
    isHolidayWork: Boolean(isHoliday) && workMinutes > 0,
  };
}

export function minutesToHHMM(min: number): string {
  const sign = min < 0 ? "-" : "";
  const m = Math.abs(min);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${sign}${h}:${String(mm).padStart(2, "0")}`;
}

export function fmtTime(d: Date | string | null | undefined): string {
  if (!d) return "--:--";
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "----/--/--";
  const date = new Date(d);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** datetime-local input 用 "YYYY-MM-DDTHH:mm"（ローカル時刻） */
export function toDatetimeLocal(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

/** date input 用 "YYYY-MM-DD"（ローカル日付） */
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** UTCのその日の0:00を返す（workDateの正規化用） */
export function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
