# work-report 要件・設計ドキュメント

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロジェクト名 | work-report |
| 配置場所 | `C:\Users\matsu\ドキュメント\arumako\work-report` |
| 目的 | 日報・工数管理・勤怠管理を **1回の入力で3つのフォーマットに自動生成** するWebアプリ |
| 経緯 | 元々はHTMLファイル1つで動く日報ジェネレーターだったものを、TanStack Startで本格的なWebアプリに移行 |

---

## 2. 背景・課題

ユーザーは以下の3つの報告を毎日手入力で行っており、同じデータを複数箇所に入力する手間が発生している。

1. **日報（フリーテキスト形式）** — プロジェクト/タスクごとの予定時間・実績時間・進捗率を報告
2. **プロジェクト別稼働報告（Excel）** — 取引先ごとに月次の工数管理表を作成。日付・始業/終業/休憩/作業時間/作業内容のカラム
3. **勤怠管理（Excel）** — 会社への勤怠報告。12ヶ月横並びの年間シート。日付・区分(稼/休)・始業/終業/休憩・勤務時間 等

---

## 3. コア要件

### 3.1 基本方針

**1回の入力 → 3つの出力**

### 3.2 入力形式

現在のHTMLと同じ構成:

- 日付 / 始業 / 終業 / 休憩
- プロジェクト → タスク（階層構造）
- 振り返り（良かった点・悪かった点・次のアクション）
- 備考欄

### 3.3 出力形式

#### (1) 日報テキスト

フリーテキスト形式（現状通り）。

#### (2) 工数管理表

取引先ごとの月次Excelライク表。

参考様式: `learning\工数入力システム\参考様式\(アルマコ社内用)工数管理.csv`

| カラム |
|--------|
| 対象月 |
| 作業者 |
| 日付 |
| 曜日 |
| 作業開始 |
| 作業終了 |
| 休憩 |
| 作業時間 |
| 作業内容 |
| 月合計 |

> **注意:** 始業/終業はそのプロジェクトに費やした時間を収めるための枠であり、実際の出退勤時刻ではない。

#### (3) 勤怠管理表

年間12ヶ月横並びExcelライク表。

参考様式: `learning\工数入力システム\参考様式\勤怠管理表.csv`

| カラム |
|--------|
| 氏名 |
| 対象月（×12） |
| 日付 |
| 区分（稼/休） |
| 始業 |
| 終業 |
| 休憩 |
| 勤務時間 |
| 遅早時間 |
| 残業時間 |
| 休出時間 |
| 深夜時間 |
| 備考 |

### 3.4 自動計算・自動判定ルール

- **区分（稼/休）**: タスク入力があれば「稼」、なければ「休」。有給等は備考欄で対応
- **勤務時間 / 遅早時間 / 残業時間 / 休出時間**: 自動計算
- **Excelエクスポート**: 将来対応。現時点ではWeb上での表示のみ

---

## 4. 追加機能要件

- **過去の日報の履歴・検索** — 日付、プロジェクト、キーワードで検索可能
- **チーム共有** — 複数人で使用し、チーム内の他メンバーの入力が閲覧可能
- **プロジェクト/タスクのマスタ管理**

---

## 5. 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フレームワーク | TanStack Start |
| ルーティング | TanStack Router（ファイルベース） |
| ビルドツール | Vite |
| DB | PostgreSQL |
| ORM | Drizzle ORM |
| 認証 | Better Auth |
| UI | Tailwind CSS v4 + shadcn/ui（将来） |
| バリデーション | Zod（将来） |
| フォント | IBM Plex Sans JP, IBM Plex Mono |

---

## 6. データモデル設計

### 6.1 ER図（テーブル一覧）

#### users

| カラム | 型 | 備考 |
|--------|----|------|
| id | PK | |
| name | | |
| email | | |
| password_hash | | |
| created_at | | |
| updated_at | | |

#### teams

| カラム | 型 | 備考 |
|--------|----|------|
| id | PK | |
| name | | |
| created_at | | |
| updated_at | | |

#### team_members

| カラム | 型 | 備考 |
|--------|----|------|
| id | PK | |
| team_id | FK → teams | |
| user_id | FK → users | |
| role | | `'owner'` \| `'member'` |
| joined_at | | |

- **UNIQUE制約:** `(team_id, user_id)`

#### projects（マスタ）

| カラム | 型 | 備考 |
|--------|----|------|
| id | PK | |
| team_id | FK → teams | |
| name | | |
| sort_order | | |
| is_archived | | |
| created_at | | |
| updated_at | | |

#### task_templates（マスタ）

| カラム | 型 | 備考 |
|--------|----|------|
| id | PK | |
| project_id | FK → projects | |
| label | | |
| name | | |
| sort_order | | |
| is_archived | | |
| created_at | | |
| updated_at | | |

#### daily_reports

| カラム | 型 | 備考 |
|--------|----|------|
| id | PK | |
| user_id | FK → users | |
| team_id | FK → teams | |
| date | | |
| start_time | | |
| end_time | | |
| break_time | | |
| good_points | | |
| bad_points | | |
| next_plan | | |
| note | | 備考 |
| created_at | | |
| updated_at | | |

- **UNIQUE制約:** `(user_id, date)` — 1日1件

#### report_entries

| カラム | 型 | 備考 |
|--------|----|------|
| id | PK | |
| report_id | FK → daily_reports (CASCADE) | |
| project_id | FK → projects (nullable) | |
| project_name | | 非正規化 |
| task_label | | |
| task_name | | |
| planned_hours | | |
| actual_hours | | |
| progress_before | | |
| progress_expected | | |
| progress_actual | | |
| sort_order | | |
| created_at | | |
| updated_at | | |

### 6.2 設計ポイント

- `report_entries` に `project_name` / `task_label` を **非正規化で保持**。マスタ名変更後も過去日報の内容が保持される
- `daily_reports` は `(user_id, date)` でユニーク（1日1件）
- `team_id` を `daily_reports` に持たせてチーム内閲覧クエリを高速化

---

## 7. ルーティング設計

| パス | 用途 |
|------|------|
| `/login` | ログイン |
| `/register` | ユーザー登録 |
| `/_authed` | 認証済みレイアウト（`beforeLoad` で認証チェック） |
| `/_authed/dashboard` | ダッシュボード（今日の日報ステータス + チーム提出状況） |
| `/_authed/reports/new` | 日報入力画面 |
| `/_authed/reports/$date` | 特定日付の日報 表示/編集 |
| `/_authed/reports/$date/preview` | 3フォーマット出力プレビュー |
| `/_authed/reports` | 日報一覧・検索 |
| `/_authed/team` | チーム管理 |
| `/_authed/team/reports` | チームメンバーの日報閲覧 |
| `/_authed/team/reports/$userId/$date` | 特定メンバーの日報 |
| `/_authed/master/projects` | プロジェクトマスタ一覧 CRUD |
| `/_authed/master/projects/$projectId` | タスクテンプレート管理 |
| `/_authed/settings` | ユーザー設定 |

---

## 8. 実装フェーズ

| フェーズ | 内容 | 状態 |
|----------|------|------|
| Phase 1 | 基盤構築 + 既存機能の移植（入力画面 + 基本出力） | **現在ここ** |
| Phase 2 | DB + 日報の永続化・検索 | 未着手 |
| Phase 3 | 認証（Better Auth） | 未着手 |
| Phase 4 | マスタ管理 | 未着手 |
| Phase 5 | チーム機能 | 未着手 |
| Phase 6 | 品質向上・デプロイ | 未着手 |

---

## 9. HTMLレビューで対応した改善（参考）

Phase 1 の移植時に、元のHTML版のレビューで検出された問題を反映済み。

### P0（重大）

- `formatHours` の "2:60" バグ修正
- 全角/半角 `％` 統一

### P1（重要）

- 入力データの自動保存（`sessionStorage`）
- Clipboard API エラーハンドリング
- CDN SRI ハッシュ追加
- フォーカスリング復活

> これらはすべて TanStack Start 版にも反映済み。

---

## 10. ディレクトリ構成（現在）

```
work-report/
├── vite.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── router.tsx
│   ├── routeTree.gen.ts          # 自動生成
│   ├── styles/
│   │   └── app.css               # Tailwind + カスタムテーマ
│   ├── lib/
│   │   ├── types.ts
│   │   ├── defaults.ts
│   │   ├── time-utils.ts
│   │   ├── report-generator.ts
│   │   └── storage.ts
│   ├── components/
│   │   ├── ui/                   # Input, Button, Label, CopyButton, CellRow
│   │   └── report/               # ProjectBlock, TaskRow, ReflectionSection
│   └── routes/
│       ├── __root.tsx
│       └── index.tsx              # メイン画面: 入力 + 4タブ出力
```
