# 00. ユーザーができること（ユースケース俯瞰）

本ドキュメント群の最初に読むファイル。`work-hub`（内部名 work-report）で **現状の実装** としてユーザーが実際に行える操作を俯瞰する。設計意図（requirements.md / implementation-plan.md）に書かれているが未実装の機能は「将来構想（未実装）」として明示的に区別する。

## サービス概要

日報・工数管理・勤怠管理を「1回の入力 → 3つのフォーマットを自動生成」する個人向け業務効率化 Web アプリ。

- 入力した日報データ（日付・始業/終業/休憩・プロジェクト/タスク・振り返り）から、以下の3フォーマットを画面上で自動生成しコピーできる。
  1. 日報テキスト（フリーテキスト形式の作業報告）
  2. プロジェクト別稼働報告（Excel セルへ貼り付ける時間・作業内容）
  3. 勤怠報告（始業/終業/休憩）
- 根拠: `apps/web/src/routes/__root.tsx:17`（タイトル「日報・工数管理システム」）、`apps/web/src/routes/index.tsx:158`（「1回の入力 → 3つのフォーマットを自動生成」）。

## 現状の実装でユーザーができること

### 1. 日報の入力（`/` 入力タブ）

- 画面上部で日付・始業・終業・休憩を入力する（`apps/web/src/routes/index.tsx:162-187`）。
- 取引先（プロジェクト）を追加・削除し、各取引先配下にタスク行を追加・削除できる（`apps/web/src/routes/index.tsx:224-237`、`apps/web/src/components/report/ProjectBlock.tsx:27`、`apps/web/src/components/report/TaskRow.tsx`）。
- 各タスクに「ラベル（プロジェクト）/ タスク名 / 予定h → 実績h / 進捗 前・見・実(%)」を入力できる（`apps/web/src/components/report/TaskRow.tsx:16-66`）。
- 振り返り（よかった点・課題点・次回の稼働予定）を入力できる（`apps/web/src/components/report/ReflectionSection.tsx`）。
- 入力中は 500ms デバウンスで sessionStorage に自動保存される（`apps/web/src/routes/index.tsx:95-100`）。

### 2. テンプレート保存（localStorage）

- 「テンプレ保存」ボタンで現在の入力内容を localStorage に保存できる（`apps/web/src/routes/index.tsx:102-106`、キー `daily-report-latest`）。
- 次回起動時、sessionStorage の自動保存が無ければ、このテンプレートからプロジェクト名・タスク名・時刻を復元する（`apps/web/src/routes/index.tsx:54-92`）。

### 3. 日報の永続保存（PostgreSQL）

- 「日報保存」ボタンで日報を DB（PostgreSQL の `daily_reports` テーブル）に保存できる（`apps/web/src/routes/index.tsx:108-121`）。
- 日付（`date`）が一意キーで、同日付は upsert（更新）される（`apps/web/src/server/functions/reports.ts:79-93`、`apps/web/src/server/schema/reports.ts:15`）。
- 保存処理はサーバ関数 `saveReportFn`（createServerFn）経由（`apps/web/src/lib/storage.ts:57-65`）。

### 4. 3フォーマットの自動生成と確認・コピー（`/` の各タブ）

- 日報タブ: フリーテキスト形式の作業報告を生成・コピー（`apps/web/src/routes/index.tsx:258-273`、生成ロジック `apps/web/src/lib/report-generator.ts:5-34`）。
- PJ稼働タブ: 取引先ごとに「作業開始/作業終了/休憩」「作業内容」のセルを生成し、タブ区切りでコピー（`apps/web/src/routes/index.tsx:275-317`、`apps/web/src/lib/report-generator.ts:37-53`）。
  - 始業/終業/休憩はそのプロジェクトに費やした実績時間から計算される（`9:00` 固定開始、実績4h超で休憩1h想定。`apps/web/src/lib/report-generator.ts:43-52`）。
- 勤怠タブ: 入力した始業/終業/休憩をそのままタブ区切りでコピー（`apps/web/src/routes/index.tsx:319-337`）。

### 5. 月次工数管理表の閲覧（`/timesheet`）

- 年月を切り替え（前後ボタン・月タブ）、その月に保存された日報からプロジェクトを選択し、日別の作業時間・作業内容の表を閲覧できる（`apps/web/src/routes/timesheet.tsx`、`apps/web/src/components/report/MonthlyTimesheetTable.tsx`）。
- データは `getReportsByMonthFn` で DB から取得（`apps/web/src/lib/storage.ts:76-82`）。閲覧専用（編集機能なし）。

### 6. 月次勤怠管理表の閲覧（`/attendance`）

- 年月を切り替え、その月の日報から日別の勤怠表（区分・始業/終業/休憩・勤務時間・遅早/残業/休出/深夜時間）を閲覧できる（`apps/web/src/routes/attendance.tsx`、`apps/web/src/components/report/AttendanceTable.tsx`）。
- 勤務時間・残業時間等は自動計算（標準勤務8時間基準。`apps/web/src/components/report/AttendanceTable.tsx:10,56-60`）。閲覧専用。

## 将来構想（requirements.md / implementation-plan.md に記載。現状未実装）

以下は設計ドキュメントに記載されているが、実コード上は存在しない。

- ユーザー認証（Better Auth）、ログイン/登録画面（`apps/web/docs/requirements.md:113,232-234`、`apps/web/docs/implementation-plan.md:173-194`）。
- チーム共有（チームメンバーの日報閲覧）、マスタ管理画面、過去日報の検索（`apps/web/docs/requirements.md:96-101,236-246`）。
- Excel エクスポート（`apps/web/docs/requirements.md:92`、現状は Web 表示とコピーのみ）。
- スキーマ定義済みだが現状の UI / サーバ関数から未使用のテーブル（goals, tasks, time_entries, schedule_entries, clients, projects, task_categories, technology_tags, effort_budgets, weekly_effort_budgets）。詳細は `04_er_diagram.md` 参照。

## 未確認事項

- 「日報削除」機能（`deleteReportFn` / `reportStorage.delete`）はコード上存在する（`apps/web/src/server/functions/reports.ts:98-103`、`apps/web/src/lib/storage.ts:67-74`）が、UI からの呼び出し箇所はリポジトリ内に見当たらない（※未確認。現状 UI から削除ボタンへの結線は確認できず）。
- 入力タブの「合計: planned → actual」表示は当日入力分のみで、過去日報の集計ではない（`apps/web/src/routes/index.tsx:137-144`）。実運用での想定利用フローは未確認。
