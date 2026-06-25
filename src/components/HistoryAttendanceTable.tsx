"use client";

import { useRouter } from "next/navigation";
import { StatusBadge } from "./StatusBadge";
import { fmtTime, minutesToHHMM } from "@/lib/attendance";

export interface HistoryRow {
  id: string;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  workMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  workTypeName: string | null;
  status: string;
}

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

export function HistoryAttendanceTable({ records }: { records: HistoryRow[] }) {
  const router = useRouter();

  return (
    <div className="card overflow-x-auto">
      <p className="px-3 pt-3 text-xs text-[var(--text-muted)]">
        行をクリックすると勤怠の詳細を表示します。
      </p>
      <table className="table-base">
        <thead>
          <tr>
            <th>日付</th>
            <th>曜日</th>
            <th>出勤</th>
            <th>退勤</th>
            <th>休憩</th>
            <th>実働</th>
            <th>残業</th>
            <th>深夜</th>
            <th>区分</th>
            <th>状態</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={11} className="py-8 text-center text-[var(--text-muted)]">
                この月の勤怠記録はありません。
              </td>
            </tr>
          ) : (
            records.map((r) => {
              const d = new Date(r.workDate);
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/attendance/${r.id}`)}
                >
                  <td>{d.getMonth() + 1}/{d.getDate()}</td>
                  <td className={d.getDay() === 0 ? "text-red-500" : d.getDay() === 6 ? "text-blue-500" : ""}>
                    {DOW[d.getDay()]}
                  </td>
                  <td>{fmtTime(r.clockIn)}</td>
                  <td>{fmtTime(r.clockOut)}</td>
                  <td>{r.breakMinutes}分</td>
                  <td>{minutesToHHMM(r.workMinutes)}</td>
                  <td>{minutesToHHMM(r.overtimeMinutes)}</td>
                  <td>{minutesToHHMM(r.nightMinutes)}</td>
                  <td>{r.workTypeName ?? "—"}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-[var(--accent)]">詳細 ›</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
