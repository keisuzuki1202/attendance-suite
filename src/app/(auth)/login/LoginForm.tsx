"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

const DEMO = [
  { label: "管理者", email: "admin@example.com" },
  { label: "産業医", email: "doctor@example.com" },
  { label: "2次承認(部長)", email: "bucho@example.com" },
  { label: "1次承認(課長)", email: "kacho@example.com" },
  { label: "従業員", email: "hanako@example.com" },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ログインに失敗しました。");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("Password123!");
  }

  return (
    <div className="w-full max-w-md">
      <div className="card p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/assets/logo.svg" alt="ロゴ" width={56} height={56} priority />
          <h1 className="mt-3 text-xl font-bold">勤怠管理システム</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            ログインして業務を開始します
          </p>
        </div>

        {error && (
          <div
            className="mb-4 rounded-lg border px-3 py-2 text-sm"
            style={{ background: "color-mix(in srgb, var(--error) 10%, transparent)", color: "var(--error)", borderColor: "var(--error)" }}
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">メールアドレス</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">パスワード</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <div className="h-px flex-1 bg-[var(--border)]" />
          または
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <button
          type="button"
          className="btn btn-outline w-full"
          onClick={() => setError("Microsoft Entra ID 連携はMVPでは未実装です（将来拡張）。")}
        >
          Microsoft Entra ID でログイン
        </button>
      </div>

      <div className="card mt-4 p-4">
        <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
          デモアカウント（パスワード共通: Password123!）
        </p>
        <div className="flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => fillDemo(d.email)}
              className="badge badge-info hover:opacity-80"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
