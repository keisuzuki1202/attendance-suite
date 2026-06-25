"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, LogOut, Moon, Sun } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";

interface Props {
  name: string;
  role: string;
  unreadCount: number;
}

export function Header({ name, role, unreadCount }: Props) {
  const router = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-end gap-3 border-b bg-[var(--card)] px-4 md:px-6">
      <button
        onClick={toggleTheme}
        className="btn btn-ghost p-2"
        aria-label="ダークモード切替"
        title="ダークモード切替"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <Link href="/notifications" className="relative btn btn-ghost p-2" aria-label="通知">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: "var(--error)" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>

      <div className="hidden text-right sm:block">
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-xs text-[var(--text-muted)]">
          {ROLE_LABELS[role] ?? role}
        </div>
      </div>
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ background: "var(--accent)" }}
      >
        {name.slice(0, 1)}
      </div>

      <button onClick={logout} className="btn btn-outline" title="ログアウト">
        <LogOut size={16} />
        <span className="hidden sm:inline">ログアウト</span>
      </button>
    </header>
  );
}
