"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Clock,
  CalendarCheck,
  FileText,
  CheckSquare,
  Bell,
  BarChart3,
  Settings,
  Users,
  Stethoscope,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}
interface NavSection {
  title?: string;
  items: NavItem[];
}

function buildNav(role: string): NavSection[] {
  if (role === "occupational_physician") {
    return [
      {
        items: [
          { href: "/physician", label: "産業医ダッシュボード", icon: <Stethoscope size={18} /> },
          { href: "/physician/reports", label: "共有レポート", icon: <FileText size={18} /> },
          { href: "/notifications", label: "通知", icon: <Bell size={18} /> },
        ],
      },
    ];
  }

  const sections: NavSection[] = [
    { items: [{ href: "/dashboard", label: "ダッシュボード", icon: <LayoutDashboard size={18} /> }] },
    {
      title: "勤怠管理",
      items: [
        { href: "/attendance", label: "勤怠登録", icon: <Clock size={18} /> },
        { href: "/attendance/history", label: "勤怠履歴", icon: <CalendarCheck size={18} /> },
        { href: "/monthly", label: "月次勤怠", icon: <CalendarCheck size={18} /> },
      ],
    },
    {
      title: "申請",
      items: [
        { href: "/applications/new/paid_leave", label: "有給休暇", icon: <FileText size={18} /> },
        { href: "/applications/new/training", label: "研修", icon: <FileText size={18} /> },
        { href: "/applications/new/business_trip", label: "出張", icon: <FileText size={18} /> },
        { href: "/applications/new/correction", label: "打刻修正", icon: <FileText size={18} /> },
        { href: "/applications", label: "申請ステータス", icon: <CheckSquare size={18} /> },
      ],
    },
  ];

  if (role === "first_approver" || role === "second_approver" || role === "admin") {
    sections.push({
      title: "承認",
      items: [
        { href: "/approvals", label: "承認待ち", icon: <CheckSquare size={18} /> },
        { href: "/approvals/history", label: "承認履歴", icon: <CheckSquare size={18} /> },
      ],
    });
  }

  sections.push({
    items: [{ href: "/notifications", label: "通知", icon: <Bell size={18} /> }],
  });

  if (role === "admin") {
    sections.push({
      title: "管理",
      items: [
        { href: "/admin", label: "管理チーム", icon: <BarChart3 size={18} /> },
        { href: "/admin/alerts", label: "労務アラート", icon: <ShieldCheck size={18} /> },
        { href: "/admin/physician-share", label: "産業医共有", icon: <Stethoscope size={18} /> },
        { href: "/admin/users", label: "従業員マスタ", icon: <Users size={18} /> },
        { href: "/admin/settings", label: "マスタ設定", icon: <Settings size={18} /> },
      ],
    });
  }

  return sections;
}

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sections = buildNav(role);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  return (
    <>
      {/* モバイル用トグル */}
      <button
        className="no-print fixed left-3 top-3 z-50 rounded-lg p-2 text-white md:hidden"
        style={{ background: "var(--primary)" }}
        onClick={() => setOpen((v) => !v)}
        aria-label="メニュー"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--primary)" }}
      >
        <div className="flex h-16 items-center gap-3 px-5">
          <Image src="/assets/logo.svg" alt="ロゴ" width={40} height={40} priority />
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">勤怠管理システム</div>
            <div className="text-[10px] text-slate-400">Attendance Suite</div>
          </div>
        </div>

        <nav className="space-y-4 px-3 pb-10">
          {sections.map((sec, i) => (
            <div key={i}>
              {sec.title && (
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {sec.title}
                </div>
              )}
              <div className="space-y-0.5">
                {sec.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`sidebar-link ${isActive(item.href) ? "active" : ""}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
