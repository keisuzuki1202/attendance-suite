"use client";

import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/attendance";

interface N {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationList({ notifications }: { notifications: N[] }) {
  const router = useRouter();

  async function read(id: string, link: string | null) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    if (link) {
      router.push(link);
    } else {
      router.refresh();
    }
  }

  async function readAll() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    router.refresh();
  }

  if (notifications.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 p-10 text-[var(--text-muted)]">
        <BellOff size={28} />
        <span>通知はありません。</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button className="btn btn-outline" onClick={readAll}>
          <CheckCheck size={16} /> すべて既読
        </button>
      </div>
      <div className="card divide-y">
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => read(n.id, n.linkUrl)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                background: n.isRead
                  ? "color-mix(in srgb, var(--text-muted) 15%, transparent)"
                  : "color-mix(in srgb, var(--accent) 15%, transparent)",
                color: n.isRead ? "var(--text-muted)" : "var(--accent)",
              }}
            >
              <Bell size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {!n.isRead && (
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                )}
                <span className={`text-sm ${n.isRead ? "" : "font-semibold"}`}>{n.title}</span>
                <span className="badge badge-muted ml-auto">
                  {NOTIFICATION_TYPE_LABELS[n.type] ?? n.type}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">{n.body}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{fmtDate(n.createdAt)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
