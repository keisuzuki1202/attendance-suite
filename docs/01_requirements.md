# 要件定義書（要件 → 実装 対応表）

本書は提示要件と本MVPの実装の対応を示す。記号: ✅実装 / 🟡簡易実装(MVP) / ⏭将来拡張。

## 1〜2. 目的・ユーザー
従業員・1次承認者・2次承認者・管理者・**産業医**の5ロールで、勤怠登録〜2階層承認〜産業医共有を一元管理。`role` と `rbac.ts` の権限マトリクスで制御。✅

## 3.1 自動勤怠登録
| 要件 | 実装 |
| --- | --- |
| PC起動を業務開始として記録 | `POST /api/pc-logs`(startup) → `attendance_records.clockIn` 自動反映 ✅ |
| PCシャットダウンを業務終了として記録 | (shutdown/logoff) → `clockOut` 自動反映 ✅ |
| 勤怠登録画面に表示 | `/attendance`（ソース=自動 表示）✅ |
| ログ取得不可時は未打刻/要確認 | 片側のみ → `status=unconfirmed` ✅ |
| 自動打刻ログを改ざん不可の監査証跡に | `pc_activity_logs` は追記専用（更新/削除しない）+ `audit_logs` ✅ |

## 3.2 打刻修正
当事者が `/applications/new/correction` から申請。対象=開始/終了/休憩/勤務区分/理由。**理由必須**(Zod)。修正前後の値・申請者・申請日時・承認者・承認日時を `correction_requests`＋`application_approval_steps`＋`audit_logs` に保存。✅

## 3.3 申請機能
有給/研修/出張を事前申請。必須=申請種別・該当日時・内容・予測効果、任意=添付・コメント（Zod superRefineで検証）。✅（添付は path/URL 文字列で受領 🟡）

## 3.4 2階層承認フロー
`workflow.ts` の状態機械で実装。承認者は従業員マスタの `firstApproverId/secondApproverId` から自動判定。1次承認→2次承認者＆当事者へ通知、2次承認→1次承認者＆当事者へ完了通知、1次差戻し→当事者通知、2次差戻し→1次承認者＆当事者通知、差戻し後は加筆して**1次から再申請**。✅

## 3.5 ステータス管理
draft/submitted/first_approved/second_approved(完了)/first_rejected/second_rejected/cancelled/rejected を `/applications` で確認。✅

## 3.6 通知機能
申請受付・承認依頼・1次/2次承認完了・差戻し・再申請を `notifications` に作成し、ヘッダーに未読バッジ。チャネル=アプリ内＋メール（**メールはモック**＝コンソール出力 🟡）。✅

## 4. 管理機能
従業員/部門/雇用区分/勤務区分/休日区分/1次・2次承認者/権限ロールを `/admin/users`・`/admin/settings` で管理。通知設定はアプリ内＋メール既定。✅

## 5 & 14.6 画面要件 / サイドバー
要求の全画面＋追加画面を実装（[docs/03_screens.md](03_screens.md)）。固定サイドバー・ロール別メニュー。✅

## 6. DB設計
13＋7＝**20テーブル**を Prisma で実装（[docs/02_er.md](02_er.md)）。✅

## 7. 権限設計
`rbac.ts` の `MATRIX` で 閲覧/申請/承認/差戻し/修正/管理者設定/産業医閲覧 をロール別に分離。✅

## 8. 監査・内部統制
- 自動打刻/修正/承認/差戻し履歴を保存、`audit_logs` に who/when/what/how。✅
- 承認済み（月次ロック）勤怠は直接編集不可（API 409）→ 打刻修正申請が必須。✅
- 承認者本人の自己承認を禁止（`canActOnApplication`）。✅

## 9. 技術要件
Next.js/React/TS、Route Handlers、Prisma、Zod、Tailwind。認証は NextAuth 同等の自前 Credentials+JWT。DBは PostgreSQL の代わりに **SQLite**（MVP即起動優先・移行手順は README）。🟡

## 11. PC起動/終了ログ
PowerShell サンプル `agent/send-pc-activity.ps1`（タスクスケジューラ登録例つき）。API は userId/employeeCode・端末ID・イベント種別・発生時刻・IPを受領。✅

## 13. 品質条件
型安全（`tsc --noEmit` パス）、エラーハンドリング、入力バリデーション(Zod)、状態遷移の整合（状態機械）、シンプルなUI。✅

## 14. UI/UX・ブランド
カラーパレット（Primary #0F172A / Accent #2563EB 等）を CSS 変数化、ロゴ `/assets/logo.svg`（左上固定・SVG）、ステータス色共通化、ダッシュボードのロール別カード、承認カード(14.8)、通知センター、レスポンシブ、ダークモード、3クリック申請。✅（Recharts/Framer Motion は未使用＝軽量CSSで代替 🟡）

## 15. 産業医連携・労務管理
| 要件 | 実装 |
| --- | --- |
| 月次勤怠確定フロー | `/monthly`：確定申請→1次/2次電子承認→ロック。ロック後は管理者の再オープンのみ ✅ |
| 電子押印・承認証跡 | `monthly_approval_logs`（承認者名・日時・コメント）、月次PDFに承認者名/日時/電子承認済み表示 ✅ |
| 管理チームダッシュボード | `/admin`：未確定/承認待ち/完了/45h/80h/産業医共有待ち/確認済み ✅ |
| 産業医共有レポート | 確定済み月次から自動生成（45h/80h/面談候補抽出）`/admin/physician-share` ✅ |
| 産業医ロール・最小権限 | `occupational_physician`：勤務時間/残業/深夜/休日/有給/面談候補/管理コメントのみ閲覧。給与・人事評価は非表示 ✅ |
| 共有ワークフロー | 2次承認→管理通知→対象確認→「産業医へ共有」→産業医通知→確認済み記録 ✅ |
| アラート | 45h/80h/深夜増/休日増 を月次ロック時に自動生成 `/admin/alerts` ✅（連続月/有給低下/承認遅延は枠のみ 🟡） |
| 追加7テーブル | monthly_attendance_closings 他 すべて実装 ✅ |
| 追加9画面 | すべて実装（[docs/03_screens.md](03_screens.md)） ✅ |
| PDF/CSV | 月次PDF・産業医レポートPDF(印刷)・各種CSV ✅ |
| 個人情報・アクセス制御 | 最小権限、産業医閲覧ログ・CSV/PDFダウンロード履歴を `audit_logs` に保存 ✅ |
