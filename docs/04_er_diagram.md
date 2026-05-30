# 04. ER 図（データベーススキーマ）

`work-hub` の DB スキーマ（Drizzle ORM / PostgreSQL）を ER 図で示す。スキーマ定義は `apps/web/src/server/schema/` 配下（`index.ts` で集約。`master.ts` / `goals.ts` / `tasks.ts` / `budgets.ts` / `reports.ts`）。

## 最重要: 実際に使われているのは `daily_reports` のみ

スキーマには **11 テーブル** が定義されているが、サーバ関数（`apps/web/src/server/functions/reports.ts`）および全 UI が実際に読み書きしているのは **`daily_reports` テーブルのみ**である。

残り 10 テーブル（`clients` / `projects` / `task_categories` / `technology_tags` / `goals` / `tasks` / `task_technology_tags` / `time_entries` / `schedule_entries` / `effort_budgets` / `weekly_effort_budgets`）は **スキーマ定義のみ存在し、UI・サーバ関数からは未使用（設計先行・未配線）**。下図では各テーブル説明に「※現状UI未使用」と明記する。

- 根拠: サーバ関数は `dailyReports` のみを import / 操作（`apps/web/src/server/functions/reports.ts:7,32,50,65,101`）。他テーブルを操作するサーバ関数・クエリはリポジトリ内に存在しない。
- 注意: フロントの `DailyReportData.projects[].tasks`（`apps/web/src/lib/types.ts:12-29`）は画面ローカル型であり、DB の `projects`/`tasks` テーブルとは別物。日報入力内容は `daily_reports.raw_data`（jsonb）に丸ごと格納される（`apps/web/src/server/functions/reports.ts:77,90`）。

## ER 図（全 11 テーブル）

凡例:
- `[使用中]` … UI・サーバ関数から実際に利用。
- `[未配線]` … スキーマ定義のみ。現状 UI・サーバ関数から未使用。
- PK = 主キー、FK = 外部キー、UQ = unique 制約 / unique index。

```mermaid
erDiagram
  daily_reports {
    uuid id PK "defaultRandom"
    date date UQ "notNull, unique（1日1件）"
    varchar start_time "notNull len10"
    varchar end_time "notNull len10"
    varchar break_time "notNull len10"
    numeric total_work_hours "p4 s2"
    text note
    text good_points
    text bad_points
    text next_plan
    jsonb raw_data "DailyReportData全体を保持"
    timestamptz created_at "notNull defaultNow"
    timestamptz updated_at "notNull defaultNow"
  }

  clients {
    uuid id PK "defaultRandom"
    varchar name "notNull len255"
    varchar code UQ "len50, unique index"
    integer sort_order "notNull default0"
    boolean is_archived "notNull default false"
    timestamptz created_at "notNull defaultNow"
    timestamptz updated_at "notNull defaultNow"
  }

  projects {
    uuid id PK "defaultRandom"
    uuid client_id FK "notNull -> clients.id"
    varchar name "notNull len255"
    varchar code UQ "len50, unique index"
    integer sort_order "notNull default0"
    boolean is_archived "notNull default false"
    timestamptz created_at "notNull defaultNow"
    timestamptz updated_at "notNull defaultNow"
  }

  task_categories {
    uuid id PK "defaultRandom"
    varchar name "notNull len255"
    varchar color "len7"
    integer sort_order "notNull default0"
    boolean is_archived "notNull default false"
    timestamptz created_at "notNull defaultNow"
    timestamptz updated_at "notNull defaultNow"
  }

  technology_tags {
    uuid id PK "defaultRandom"
    varchar name UQ "notNull len100 unique"
    timestamptz created_at "notNull defaultNow"
  }

  goals {
    uuid id PK "defaultRandom"
    varchar title "notNull len255"
    text description
    date target_date
    varchar status "notNull default active CHK(active/completed/archived)"
    timestamptz created_at "notNull defaultNow"
    timestamptz updated_at "notNull defaultNow"
  }

  tasks {
    uuid id PK "defaultRandom"
    varchar type "notNull CHK(project/adhoc/routine)"
    varchar title "notNull len255"
    text description
    varchar status "notNull default active CHK(active/completed/archived)"
    varchar priority "notNull default medium CHK(low/medium/high/urgent)"
    uuid goal_id FK "-> goals.id (nullable)"
    uuid client_id FK "-> clients.id (nullable)"
    uuid project_id FK "-> projects.id (nullable)"
    uuid category_id FK "-> task_categories.id (nullable)"
    uuid parent_task_id "自己参照（FK制約なし・カラムのみ）"
    numeric estimated_hours "p6 s2"
    numeric actual_hours "p6 s2"
    varchar complexity "CHK(null/small/medium/large)"
    date due_date
    timestamptz created_at "notNull defaultNow"
    timestamptz updated_at "notNull defaultNow"
    note compound_check "複合CHK chk_task_type_project: type=project なら project_id 必須"
  }

  task_technology_tags {
    uuid task_id FK "notNull -> tasks.id (onDelete cascade)"
    uuid tag_id FK "notNull -> technology_tags.id (onDelete cascade)"
  }

  time_entries {
    uuid id PK "defaultRandom"
    uuid task_id FK "notNull -> tasks.id"
    date date "notNull"
    numeric hours "notNull p4 s2 CHK(>0)"
    text note
    timestamptz created_at "notNull defaultNow"
    timestamptz updated_at "notNull defaultNow"
  }

  schedule_entries {
    uuid id PK "defaultRandom"
    uuid task_id FK "notNull -> tasks.id"
    date date "notNull"
    numeric planned_hours "notNull p4 s2 CHK(>0)"
    boolean is_cancelled "notNull default false"
    timestamptz created_at "notNull defaultNow"
    timestamptz updated_at "notNull defaultNow"
  }

  effort_budgets {
    uuid id PK "defaultRandom"
    uuid client_id FK "-> clients.id (nullable)"
    uuid project_id FK "-> projects.id (nullable)"
    integer year "notNull"
    integer month "notNull CHK(1..12)"
    numeric budget_hours "notNull p6 s2 CHK(>=0)"
    timestamptz created_at "notNull defaultNow"
    timestamptz updated_at "notNull defaultNow"
  }

  weekly_effort_budgets {
    uuid id PK "defaultRandom"
    uuid client_id FK "-> clients.id (nullable)"
    uuid project_id FK "-> projects.id (nullable)"
    integer year "notNull"
    integer week_number "notNull CHK(1..53)"
    numeric budget_hours "notNull p6 s2 CHK(>=0)"
    timestamptz created_at "notNull defaultNow"
    timestamptz updated_at "notNull defaultNow"
  }

  clients ||--o{ projects : "client_id"
  goals ||--o{ tasks : "goal_id"
  clients ||--o{ tasks : "client_id"
  projects ||--o{ tasks : "project_id"
  task_categories ||--o{ tasks : "category_id"
  tasks ||--o{ tasks : "parent_task_id（自己参照）"
  tasks ||--o{ task_technology_tags : "task_id"
  technology_tags ||--o{ task_technology_tags : "tag_id"
  tasks ||--o{ time_entries : "task_id"
  tasks ||--o{ schedule_entries : "task_id"
  clients ||--o{ effort_budgets : "client_id"
  projects ||--o{ effort_budgets : "project_id"
  clients ||--o{ weekly_effort_budgets : "client_id"
  projects ||--o{ weekly_effort_budgets : "project_id"
```

## テーブル別メモ（使用状況つき）

| テーブル | 使用状況 | 補足・制約 | 根拠 |
|---|---|---|---|
| daily_reports | **[使用中]** | `date` unique（1日1件）。入力全体を `raw_data`(jsonb) に保持。upsert キーは `date`。 | `apps/web/src/server/schema/reports.ts:13-31`、`apps/web/src/server/functions/reports.ts:79-93` |
| clients | [未配線] ※現状UI未使用 | `code` に unique index（`clients_code_idx`）。 | `apps/web/src/server/schema/master.ts:12-28` |
| projects | [未配線] ※現状UI未使用 | `client_id` → clients.id（notNull）。`code` に unique index。 | `apps/web/src/server/schema/master.ts:31-50` |
| task_categories | [未配線] ※現状UI未使用 | `color` は len7（カラーコード想定。※推測）。 | `apps/web/src/server/schema/master.ts:53-65` |
| technology_tags | [未配線] ※現状UI未使用 | `name` unique。 | `apps/web/src/server/schema/master.ts:68-74` |
| goals | [未配線] ※現状UI未使用 | `status` に check（active/completed/archived）。 | `apps/web/src/server/schema/goals.ts:5-26` |
| tasks | [未配線] ※現状UI未使用 | FK 4本（goal/client/project/category, いずれも nullable）。`parent_task_id` は自己参照だが drizzle 上は FK 制約を付けず uuid カラムのみ。check 制約 5本（type/status/priority/complexity/project必須）。index 3本。 | `apps/web/src/server/schema/tasks.ts:18-71` |
| task_technology_tags | [未配線] ※現状UI未使用 | PK 定義なし、`task_id`/`tag_id` ともに notNull で cascade 削除。index `task_tags_task_idx`。 | `apps/web/src/server/schema/tasks.ts:74-85` |
| time_entries | [未配線] ※現状UI未使用 | `hours > 0` check。index 3本（date / task / task+date）。 | `apps/web/src/server/schema/tasks.ts:88-111` |
| schedule_entries | [未配線] ※現状UI未使用 | `planned_hours > 0` check。index 2本。 | `apps/web/src/server/schema/tasks.ts:114-139` |
| effort_budgets | [未配線] ※現状UI未使用 | (client,project,year,month) unique index。month は 1..12 check。 | `apps/web/src/server/schema/budgets.ts:14-40` |
| weekly_effort_budgets | [未配線] ※現状UI未使用 | (client,project,year,week_number) unique index。week は 1..53 check。 | `apps/web/src/server/schema/budgets.ts:43-75` |

## 補足

- 全テーブルに `created_at` / `updated_at`（timestamptz, defaultNow）があるが、`technology_tags` のみ `updated_at` を持たない（`created_at` のみ）。根拠: `apps/web/src/server/schema/master.ts:68-74`。
- マイグレーション出力先は `drizzle/`、drizzle-kit 設定は `drizzle.config.ts`（schema は `apps/web/src/server/schema/index.ts` を指す。`drizzle.config.ts:4`）。
- ローカル DB は docker-compose（PostgreSQL 16-alpine、DB 名 `workhub`）。`docker-compose.yml:2-18`。

## 未確認事項

- `task_technology_tags` に明示的な複合 PK が定義されていない（`task_id`+`tag_id` の notNull のみ。`apps/web/src/server/schema/tasks.ts:74-85`）。重複行防止の一意制約が無いため、運用上の重複可否は未確認（※未確認）。
- `tasks.parent_task_id` は uuid カラムとして定義されるが `.references()` が付与されていないため、DB レベルの FK 制約は生成されない見込み（※推測。マイグレーション SQL 未確認）。
- 各テーブルの check 制約・index がマイグレーション（`drizzle/`）に正しく反映されているかは、生成済み SQL を未読のため未検証（※未確認）。
