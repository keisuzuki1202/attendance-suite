# API一覧

すべて JSON。エラーは `{ "error": string, "details"?: any }`。ページAPI以外は認証Cookie必須（`/api/auth/login`・`/api/pc-logs` を除く）。

## 認証
| Method | Path | 権限 | 内容 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | 公開 | メール+PWでログイン、JWT Cookie発行 |
| POST | `/api/auth/logout` | 認証 | ログアウト |

## 勤怠 / PCログ
| Method | Path | 権限 | 内容 |
| --- | --- | --- | --- |
| POST | `/api/attendance` | 本人 | 勤怠手動登録(upsert)。ロック済みは409 |
| POST | `/api/pc-logs` | APIキー(`x-api-key`) | PC起動/終了ログ受信→監査保存＆勤怠自動反映 |

PCログ Body 例:
```json
{ "employeeCode": "E0005", "terminalId": "PC-01", "eventType": "startup", "occurredAt": "2026-06-25T09:00:00+09:00", "ipAddress": "192.168.0.10" }
```

## 申請 / 2階層承認
| Method | Path | 権限 | 内容 |
| --- | --- | --- | --- |
| GET | `/api/applications` | 本人 | 自分の申請一覧 |
| POST | `/api/applications` | 本人 | 申請作成（`submit:true`で即提出）。correctionは前値スナップショット保存 |
| POST | `/api/applications/{id}/submit` | 本人 | 提出 |
| POST | `/api/applications/{id}/resubmit` | 本人 | 差戻し後の再申請（1次から） |
| POST | `/api/applications/{id}/approve` | 承認者(順序・非本人) | 承認（comment任意） |
| POST | `/api/applications/{id}/reject` | 承認者(順序・非本人) | 差戻し（comment必須） |
| POST | `/api/applications/{id}/cancel` | 本人 | 取消 |

## 月次勤怠（電子承認）
| Method | Path | 権限 | 内容 |
| --- | --- | --- | --- |
| POST | `/api/monthly/{id}/submit` | 本人 | 月次確定申請（集計再計算） |
| POST | `/api/monthly/{id}/approve` | 承認者 | 1次/2次電子承認。2次でロック＆アラート生成 |
| POST | `/api/monthly/{id}/reopen` | 管理者 | 確定後の再オープン（修正許可） |

## 通知
| Method | Path | 権限 | 内容 |
| --- | --- | --- | --- |
| POST | `/api/notifications/{id}/read` | 本人 | 既読化 |
| POST | `/api/notifications/read-all` | 本人 | すべて既読 |

## 管理（admin）
| Method | Path | 内容 |
| --- | --- | --- |
| GET/POST | `/api/admin/users` | 従業員一覧 / 作成 |
| PATCH | `/api/admin/users/{id}` | ロール・部門・承認者・有効無効 更新 |
| POST | `/api/admin/masters` | 部門/雇用区分/勤務区分 追加 |
| POST | `/api/admin/reports` | 確定済み月次から産業医レポート生成 |
| POST | `/api/admin/reports/{id}/share` | 産業医へ共有（通知） |
| GET | `/api/admin/export/long-workers` | 長時間労働者CSV |
| GET | `/api/admin/export/department-summary` | 部門別勤怠サマリーCSV |

## 帳票 / 産業医
| Method | Path | 権限 | 内容 |
| --- | --- | --- | --- |
| GET | `/api/reports/{id}/csv` | 管理/産業医 | 産業医共有レポートCSV（DL履歴を監査記録） |
| POST | `/api/physician/items/{id}/comment` | 産業医 | 所見コメント登録 |
| POST | `/api/physician/items/{id}/review` | 産業医 | 確認済みにする（管理へ通知） |

PDFは画面 `/monthly/{id}/pdf`・`/physician/reports/{id}` の印刷（ブラウザPDF保存）で出力。
