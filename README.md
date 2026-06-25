# 勤怠・申請管理システム（MVP）

従業員の勤怠登録・打刻修正・各種申請（有給/研修/出張）・**2階層承認**・通知・月次勤怠確定・**産業医連携**までを一元管理する業務システムです。ビーウェーブ「Smart Time Recorder」を参考に、紙・押印運用を電子承認・電子保管に置き換えることを目的としています。

現代的なSaaSレベルのUI（shadcn風のクリーンなTailwind UI / ダークモード / レスポンシブ / WCAG配慮）で実装しています。

---

## 技術スタック

| 領域 | 採用 |
| --- | --- |
| Frontend / Backend | **Next.js 16**（App Router, Route Handlers）/ React 19 / TypeScript |
| DB | **SQLite**（ローカルMVP・ゼロ設定）※PostgreSQLへ移行可 |
| ORM | **Prisma 7**（driver adapter: libSQL） |
| 認証 | Credentials + JWT(HttpOnly Cookie)（`jose` / `bcryptjs`）※NextAuth相当の自前実装 |
| バリデーション | Zod |
| UI | Tailwind CSS v4 / Lucide Icons |
| メール | 開発用モック（コンソール出力。SMTP/SESへ差し替え可） |
| 帳票 | 月次勤怠表 / 産業医レポートを印刷→PDF、CSVエクスポート |

> **MVPの方針による技術選択**
> - DB は「設定ゼロで即起動」を優先し SQLite を採用（仕様の PostgreSQL からの変更点。移行手順は後述）。
> - 認証は NextAuth ではなく同等の Credentials + JWT を自前実装（依存を最小化）。
> - PDF はサーバ生成ライブラリではなく印刷用ページ（ブラウザのPDF保存）で実現。

---

## セットアップ

前提: **Node.js 20.9+**（開発・確認は v24 / npm 11）。

```bash
cd kintai-system
npm install                 # 依存導入（※npm11はinstallスクリプト承認が必要: npm approve-scripts --all）
npx prisma migrate dev      # DB作成 + マイグレーション（初回のみ）
npm run db:seed             # 初期データ投入
npm run dev                 # http://localhost:3000
```

`npm run db:reset` で DB を初期化して再シードできます。

### 環境変数（`.env`）

```ini
DATABASE_URL="file:./dev.db"          # SQLite
AUTH_SECRET="<ランダムな十分長い文字列>" # JWT署名鍵
PC_AGENT_API_KEY="<PCログ送信用APIキー>" # PowerShellエージェントと一致させる
```

---

## デモアカウント（共通パスワード: `Password123!`）

| ロール | メール | 主な権限 |
| --- | --- | --- |
| 管理者 admin | `admin@example.com` | 全機能・マスタ管理・産業医共有 |
| 産業医 occupational_physician | `doctor@example.com` | 共有された勤務時間情報の閲覧・コメント・確認のみ |
| 2次承認者（部長） | `bucho@example.com` | 2次承認 |
| 1次承認者（課長） | `kacho@example.com` | 1次承認 |
| 従業員 | `hanako@example.com` / `kenta@example.com` | 勤怠・申請 |

---

## PC起動/終了ログ（自動勤怠登録）

Webアプリ単体ではPCの起動/終了を取得できないため、端末側エージェントから API へ送信します（要件11）。

- エンドポイント: `POST /api/pc-logs`（`x-api-key` ヘッダで保護）
- サンプル: [`agent/send-pc-activity.ps1`](agent/send-pc-activity.ps1)（タスクスケジューラ登録例も同梱）

```powershell
powershell -ExecutionPolicy Bypass -File agent/send-pc-activity.ps1 -EventType startup  -EmployeeCode E0005
powershell -ExecutionPolicy Bypass -File agent/send-pc-activity.ps1 -EventType shutdown -EmployeeCode E0005
```

受信した起動/終了は監査証跡として `pc_activity_logs` に追記保存し、その日の勤怠（開始/終了時刻）へ自動反映します。

---

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバ |
| `npm run build` / `npm start` | 本番ビルド / 起動 |
| `npm run db:migrate` | マイグレーション |
| `npm run db:seed` | 初期データ投入 |
| `npm run db:reset` | DB初期化 + 再シード |
| `npm test` | 単体・結合テスト（19ケース） |

---

## ドキュメント

| ファイル | 内容 |
| --- | --- |
| [docs/01_requirements.md](docs/01_requirements.md) | 要件定義書（要件→実装対応表） |
| [docs/02_er.md](docs/02_er.md) | ER図（Mermaid・全20テーブル） |
| [docs/03_screens.md](docs/03_screens.md) | 画面一覧・画面遷移 |
| [docs/04_api.md](docs/04_api.md) | API一覧 |
| [docs/05_test_cases.md](docs/05_test_cases.md) | テストケース |

---

## アーキテクチャ概要

```
src/
  app/
    (auth)/login                  ログイン
    (app)/                        認証必須の業務画面（サイドバー+ヘッダー）
      dashboard, attendance, monthly, applications, approvals,
      notifications, admin, physician
    api/                          Route Handlers（REST）
      auth, pc-logs, attendance, applications, monthly,
      admin(reports/users/masters/export), physician, notifications, reports
  components/                     UI部品（サイドバー/ヘッダー/フォーム/承認カード等）
  lib/
    prisma.ts                     Prismaクライアント（libSQLアダプタ）
    auth.ts / rbac.ts             認証 / 権限マトリクス（内部統制）
    workflow.ts                   申請2階層承認の状態機械
    monthly.ts                    月次確定・電子承認・アラート生成
    attendance.ts                 勤怠計算（実働/残業/深夜）
    api.ts                        共通レスポンス・監査ログ・通知（メールモック）
  generated/prisma                Prisma生成クライアント
prisma/schema.prisma, seed.ts
agent/send-pc-activity.ps1        PCログ送信サンプル
tests/run.ts                      テスト
```

### 内部統制（要件8）
- 自動打刻ログ・修正履歴・承認/差戻し履歴をすべて保存。`audit_logs` に「誰が・いつ・何を・どう変更したか」を記録（CSV/PDF/産業医閲覧も記録）。
- 承認済み（月次ロック）勤怠は一般ユーザーが直接編集不可。修正は必ず打刻修正申請フローを経由。
- 承認者本人は自分の申請を承認不可（`canActOnApplication`）。

---

## PostgreSQL への移行

1. `prisma/schema.prisma` の `datasource db { provider = "postgresql" }` に変更。
2. `DATABASE_URL` を Postgres 接続文字列に変更。
3. `src/lib/prisma.ts` のアダプタを `@prisma/adapter-pg`（`PrismaPg`）に差し替え。
4. `npx prisma migrate dev` を実行。
   （String で管理している列挙値は、必要に応じて native enum へ置換可能。）

---

## 将来拡張（設計済みの拡張ポイント）
Teams/Slack通知・経費精算/給与/人事評価連携・Microsoft Entra ID(SSO)・AI労務リスク分析/残業予測 等。通知は `channel` を持ち、承認フローは状態機械として分離しているため拡張容易です。
