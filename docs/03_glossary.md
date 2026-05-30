# 03. 主な用語（用語集）

`work-hub`（内部名 work-report、タイトル「日報・工数管理システム」）のドキュメント・コードに登場する主な用語を整理する。表記は `docs/00`〜`docs/02` と統一する。

## サービス・全体

| 用語 | 説明 | 根拠 |
|---|---|---|
| work-hub | リポジトリ上のプロジェクト名（正式名）。 | `package.json:2` |
| work-report | 設計ドキュメント上の内部名。 | `apps/web/docs/requirements.md:7`（`docs/01_background.md:7` で言及） |
| 日報・工数管理システム | アプリのタイトル（HTML title）。 | `apps/web/src/routes/__root.tsx:17` |
| 1回の入力 → 3つの出力 | 基本方針。1度の日報入力から3フォーマットを自動生成する。UI 上の標語は「1回の入力 → 3つのフォーマットを自動生成」。 | `apps/web/src/routes/index.tsx:158`、`docs/01_background.md:19` |
| 利用者（単一） | 現状唯一の利用者ロール。認証未実装のため全画面・全データに無制限アクセス。 | `docs/02_users.md:17` |

## 入力データ（画面ローカルの TypeScript 型）

以下はフロントの型 `DailyReportData`（`apps/web/src/lib/types.ts`）に属する語彙であり、DB スキーマの同名テーブルとは別物である点に注意（後述の「混同注意」を参照）。

| 用語 | 説明 | 根拠 |
|---|---|---|
| DailyReportData | 1日分の日報入力データを表すフロント型。日付・始業/終業/休憩・projects 配列・振り返り（goodPoints/badPoints/nextPlan）を持つ。 | `apps/web/src/lib/types.ts:19-29` |
| Project（フロント型） | 日報入力上の「取引先（プロジェクト）」ブロック。`name` と `tasks` 配列を持つ。UI 上のボタン表記は「取引先追加」。 | `apps/web/src/lib/types.ts:12-17`、`apps/web/src/routes/index.tsx:224` |
| Task（フロント型） | プロジェクト配下の作業行。`label`（ラベル/プロジェクト）・`name`（タスク名）・`plannedHours`（予定h）・`actualHours`（実績h）・進捗3種を持つ。 | `apps/web/src/lib/types.ts:1-10` |
| 予定h / 実績h（planned / actual） | タスク単位の予定時間・実績時間（文字列で保持し `parseFloat` で数値化）。画面ヘッダの「合計: ○h → ○h」はこれらの当日合計。 | `apps/web/src/lib/types.ts:5-6`、`apps/web/src/routes/index.tsx:137-144` |
| 進捗 前・見・実（progressBefore / progressExpected / progressActual） | タスクの進捗率（作業前％・見込％・実績％）。 | `apps/web/src/lib/types.ts:7-9`、`apps/web/src/lib/report-generator.ts:18` |
| 振り返り（よかった点 / 課題点 / 次回の稼働予定） | goodPoints / badPoints / nextPlan。日報テキストの末尾に出力される。 | `apps/web/src/lib/types.ts:27-29`、`apps/web/src/lib/report-generator.ts:23-31` |
| StoredReports | 日付をキーに DailyReportData を持つ集合型（`{ "2026-03-18": {...} }`）。`getAllReportsFn` の戻り値型。 | `apps/web/src/lib/types.ts:31-34`、`apps/web/src/server/functions/reports.ts:33-37` |

## 3つの出力フォーマット

| 用語 | 説明 | 根拠 |
|---|---|---|
| (1) 日報テキスト | フリーテキスト形式の作業報告。`＜日付 作業報告＞` 見出し＋プロジェクト/タスク行＋振り返りを生成。 | `apps/web/src/routes/index.tsx:261`、`apps/web/src/lib/report-generator.ts:5-34` |
| (2) プロジェクト別稼働報告（PJ稼働） | 取引先ごとに Excel セルへ貼り付ける「作業開始/作業終了/休憩」「作業内容」を生成。タブ区切りでコピー。 | `apps/web/src/routes/index.tsx:278`、`apps/web/src/lib/report-generator.ts:37-53` |
| (3) 勤怠報告 | 入力した始業/終業/休憩をそのままタブ区切りでコピー。会社への勤怠報告用。 | `apps/web/src/routes/index.tsx:322-333` |
| getProjectSummary | (2) の算出関数。開始 `9:00` 固定、実績合計 + 休憩（実績4h超で1h）から終了時刻を計算。 | `apps/web/src/lib/report-generator.ts:37-53` |

## 月次表示・勤怠計算

| 用語 | 説明 | 根拠 |
|---|---|---|
| 月次工数管理表（タイムシート） | `/timesheet` 画面。月内日報からプロジェクト別に日別作業時間・作業内容を表示（閲覧専用）。 | `apps/web/src/routes/timesheet.tsx`、`docs/00_user_features.md:43-46` |
| 月次勤怠管理表 | `/attendance` 画面。月内日報から日別の勤怠表を表示（閲覧専用）。標準勤務は 8 時間（`STANDARD_WORK_HOURS = 8`）。勤務時間 = 終業 − 始業 − 休憩（`:54`）、遅早 = max(0, 8 − 勤務)（`:56`）、残業 = max(0, 勤務 − 8)（`:57`）、休出 = 週末の勤務時間（`:58`）、深夜 = 終業が 22 時超なら 終業 − 22（簡易計算、`:60`）。 | `apps/web/src/routes/attendance.tsx`、`apps/web/src/components/report/AttendanceTable.tsx:10,54,56-58,60`、`docs/00_user_features.md:48-51` |
| 区分（稼/休/休出） | 勤怠表の各日の区分。平日は「稼」、週末で勤務時間が 0 なら「休」、週末で勤務時間ありなら「休出」（`category: isWeekend ? (workHours > 0 ? '休出' : '休') : '稼'`）。 | `docs/01_background.md:22`、`apps/web/src/components/report/AttendanceTable.tsx:64` |

## サーバ関数・永続化

| 用語 | 説明 | 根拠 |
|---|---|---|
| createServerFn | TanStack Start のサーバ関数定義 API。クライアントから直接呼び出せる。BFF 的な API ルートは廃止済み。 | `apps/web/src/server/functions/reports.ts:5`、`docs/01_background.md:31` |
| inputValidator | createServerFn の入力受け取り。旧 `.validator` から移行済み。 | `apps/web/src/server/functions/reports.ts:42,60,99` |
| getAllReportsFn | 全日報取得（GET）。StoredReports を返す。 | `apps/web/src/server/functions/reports.ts:30-39` |
| getReportsByMonthFn | 指定年月の日報取得（GET）。`date` 範囲で抽出。 | `apps/web/src/server/functions/reports.ts:41-57` |
| saveReportFn | 日報保存（POST）。`date` をキーに upsert。 | `apps/web/src/server/functions/reports.ts:59-96` |
| deleteReportFn | 日報削除（POST）。`date` 指定で削除。UI からの呼び出しは未確認。 | `apps/web/src/server/functions/reports.ts:98-103`、`docs/00_user_features.md:64` |
| reportStorage | 上記サーバ関数のクライアント側ラッパ（save/getByMonth/getAll/delete）。 | `apps/web/src/lib/storage.ts:48-83` |
| storage / session | localStorage（テンプレート保存）/ sessionStorage（自動保存）のラッパ。 | `apps/web/src/lib/storage.ts:10-45` |
| rawData（raw_data, jsonb） | `daily_reports` テーブルの jsonb カラム。DailyReportData 全体をそのまま保持する。読み出し時はこの値を優先して復元。 | `apps/web/src/server/schema/reports.ts:24`、`apps/web/src/server/functions/reports.ts:14-15` |

## DB スキーマ用語（drizzle テーブル）

下表のうち `daily_reports` のみが実際に UI・サーバ関数から読み書きされる。残り10テーブルは**スキーマ定義のみ存在し未配線（UI 未使用）**。詳細は `04_er_diagram.md`。

| テーブル | 説明 | 使用状況 | 根拠 |
|---|---|---|---|
| daily_reports | 日報。`date` が unique（1日1件）。`raw_data` に DailyReportData 全体を保持。 | 使用中 | `apps/web/src/server/schema/reports.ts:13-31` |
| clients | 取引先マスタ。 | ※現状 UI 未使用 | `apps/web/src/server/schema/master.ts:12-28` |
| projects | プロジェクトマスタ（clients に FK）。 | ※現状 UI 未使用 | `apps/web/src/server/schema/master.ts:31-50` |
| task_categories | タスクカテゴリマスタ。 | ※現状 UI 未使用 | `apps/web/src/server/schema/master.ts:53-65` |
| technology_tags | 技術タグマスタ（name unique）。 | ※現状 UI 未使用 | `apps/web/src/server/schema/master.ts:68-74` |
| goals | 目標（中長期）。status に check 制約。 | ※現状 UI 未使用 | `apps/web/src/server/schema/goals.ts:5-26` |
| tasks | タスク。goals/clients/projects/task_categories に FK、parent_task_id で自己参照。type/status/priority/complexity に check 制約。 | ※現状 UI 未使用 | `apps/web/src/server/schema/tasks.ts:18-71` |
| task_technology_tags | tasks × technology_tags の中間テーブル（onDelete cascade）。 | ※現状 UI 未使用 | `apps/web/src/server/schema/tasks.ts:74-85` |
| time_entries | 工数記録（実績）。tasks に FK。`hours > 0` 制約。 | ※現状 UI 未使用 | `apps/web/src/server/schema/tasks.ts:88-111` |
| schedule_entries | 予定工数。tasks に FK。`planned_hours > 0` 制約。 | ※現状 UI 未使用 | `apps/web/src/server/schema/tasks.ts:114-139` |
| effort_budgets | 月間工数予算（clients/projects に FK、年月 unique）。 | ※現状 UI 未使用 | `apps/web/src/server/schema/budgets.ts:14-40` |
| weekly_effort_budgets | 週次工数予算（年・週番号 unique）。 | ※現状 UI 未使用 | `apps/web/src/server/schema/budgets.ts:43-75` |

### 混同注意: フロント型 `projects`/`tasks` と DB テーブル `projects`/`tasks`

- フロントの `DailyReportData.projects[].tasks`（`apps/web/src/lib/types.ts:12-29`）は**画面ローカルの入力構造**であり、DB の `projects` / `tasks` テーブル（`apps/web/src/server/schema/tasks.ts`, `master.ts`）とは**無関係**。
- 日報保存時、フロントの projects/tasks は `daily_reports.raw_data`（jsonb）にまとめて格納されるだけで、DB の正規化テーブルには展開されない（`apps/web/src/server/functions/reports.ts:65-93`）。
- ER 図では DB スキーマ（drizzle）を正とする。

## 認証関連（将来構想・未実装）

| 用語 | 説明 | 根拠 |
|---|---|---|
| Better Auth | 設計ドキュメントに記載の認証ライブラリ。現状未配線（依存も無し）。 | `docs/02_users.md:33`、`apps/web/package.json:14-22` |
| users / teams / team_members | 設計上のユーザー・チーム・メンバーテーブル。現状スキーマに存在しない。 | `docs/01_background.md:36-39` |
| owner / member | 設計上のチームメンバーのロール。未実装。 | `docs/02_users.md:34` |

## 未確認事項

- `deleteReportFn` に対応する UI 上の削除操作は確認できていない（`docs/00_user_features.md:64` と同様）。
