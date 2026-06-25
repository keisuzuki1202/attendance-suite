"use client";

import { useRouter } from "next/navigation";
import { StatusBadge } from "./StatusBadge";
import { fmtDate, fmtTime, minutesToHHMM } from "@/lib/attendance";

export interface AttendanceRow {
  id: string;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  workMinutes: number;
  overtimeMinutes: number;
  workTypeName: string | null;
  source: string;
  status: string;
}

export function MonthlyAttendanceTable({ records }: { records: AttendanceRow[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>日付</th>
            <th>区分</th>
            <th>出勤</th>
            <th>退勤</th>
            <th>休憩</th>
            <th>実働</th>
            <th>残業</th>
            <th>ソース</th>
            <th>状態</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={10} className="py-8 text-center text-[var(--text-muted)]">
                当月の勤怠記録はまだありません。
              </td>
            </tr>
          ) : (
            records.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer"
                onClick={() => router.push(`/attendance/${r.id}`)}
              >
                <td className="font-medium">{fmtDate(r.workDate)}</td>
                <td>{r.workTypeName ?? "—"}</td>
                <td>{fmtTime(r.clockIn)}</td>
                <td>{fmtTime(r.clockOut)}</td>
                <td>{r.breakMinutes}分</td>
                <td>{minutesToHHMM(r.workMinutes)}</td>
                <td>{minutesToHHMM(r.overtimeMinutes)}</td>
                <td>{r.source === "auto" ? "自動" : "手動"}</td>
                <td><StatusBadge status={r.status} /></td>
                <td className="text-[var(--accent)]">詳細 ›</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
