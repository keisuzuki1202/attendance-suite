import Link from "next/link";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  unit,
  tone = "default",
  href,
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "default" | "accent" | "success" | "warning" | "error";
  href?: string;
  icon?: React.ReactNode;
}) {
  const toneColor: Record<string, string> = {
    default: "var(--text)",
    accent: "var(--accent)",
    success: "var(--success)",
    warning: "var(--warning)",
    error: "var(--error)",
  };
  const inner = (
    <div className="card p-5 transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--text-muted)]">{label}</span>
        {icon && <span style={{ color: toneColor[tone] }}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold" style={{ color: toneColor[tone] }}>
          {value}
        </span>
        {unit && <span className="text-sm text-[var(--text-muted)]">{unit}</span>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="card p-10 text-center text-sm text-[var(--text-muted)]">
      {message}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
