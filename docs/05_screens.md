# 05. 画面一覧

`work-hub` の画面（ルート）一覧。ルートは TanStack Router のファイルベースルーティングで定義され、自動生成された `apps/web/src/routeTree.gen.ts` で確認できる。**画面は全 3 つ**（`/`, `/timesheet`, `/attendance`）であり、認証・認可は未実装のためアクセス権はすべて「制限なし（認証未実装）」。

- 根拠: `apps/web/src/routeTree.gen.ts:32-54`（fullPaths は `/` | `/attendance` | `/timesheet`）、`apps/web/src/routes/` 配下のファイル。
- ルートレイアウト（共通）: `apps/web/src/routes/__root.tsx`。グローバルナビ（日報入力 / 工数管理 / 勤怠管理）を全画面共通で表示（`apps/web/src/routes/__root.tsx:45-50`）。

## 画面一覧

| パス | コンポーネント名 | 概要 | アクセス権 |
|---|---|---|---|
| （共通レイアウト） | `RootComponent`（`__root.tsx`） | 全画面共通のルートレイアウト。HTML head 設定（title「日報・工数管理システム」）とグローバルナビ（日報入力/工数管理/勤怠管理の3リンク）。 | 制限なし（認証未実装） |
| `/` | `HomePage`（`index.tsx`） | 日報入力画面。入力タブで日付・始業/終業/休憩・取引先（プロジェクト）/タスク・振り返りを入力し、日報テキスト/PJ稼働/勤怠の3フォーマットを生成・コピー。テンプレ保存（localStorage）・日報保存（DB）。 | 制限なし（認証未実装） |
| `/timesheet` | `TimesheetPage`（`timesheet.tsx`） | 月次工数管理（タイムシート）画面。年月を切替え、当月の日報からプロジェクトを選び、日別の作業時間・作業内容の表を閲覧（閲覧専用）。 | 制限なし（認証未実装） |
| `/attendance` | `AttendancePage`（`attendance.tsx`） | 月次勤怠管理画面。年月を切替え、当月の日報から日別の勤怠表を閲覧（閲覧専用）。 | 制限なし（認証未実装） |

根拠（コンポーネント名・パス）:
- `__root.tsx`: `RootComponent`（`apps/web/src/routes/__root.tsx:41`）、ナビリンク（`:47-49`）。
- `index.tsx`: `createFileRoute('/')`（`apps/web/src/routes/index.tsx:18`）、`HomePage`（`:45`）。
- `timesheet.tsx`: `createFileRoute('/timesheet')`（`apps/web/src/routes/timesheet.tsx:9`）、`TimesheetPage`（`:13`）。
- `attendance.tsx`: `createFileRoute('/attendance')`（`apps/web/src/routes/attendance.tsx:9`）、`AttendancePage`（`:13`）。

## `/`（日報入力画面）の画面内タブと主要操作

`HomePage` は単一ルート内に 4 タブを持つ（`activeTab: 'input' | 'daily' | 'project' | 'attendance'`。`apps/web/src/routes/index.tsx:22,47`）。

| タブ | 表示名 | 内容 | 根拠 |
|---|---|---|---|
| input | ✏️ 入力 | プロジェクト・タスク入力、振り返り入力。テンプレ保存/日報保存/取引先追加ボタン。「出力を確認 →」で daily タブへ。 | `apps/web/src/routes/index.tsx:196-256` |
| daily | 📝 日報 | (1) 日報テキスト（フリーテキスト）をプレビュー・コピー。 | `apps/web/src/routes/index.tsx:258-273` |
| project | 📊 PJ稼働 | (2) プロジェクト別稼働報告。取引先ごとに時間セル・作業内容セルを生成・コピー。 | `apps/web/src/routes/index.tsx:275-317` |
| attendance | 🕐 勤怠 | (3) 勤怠報告。始業/終業/休憩をタブ区切りでコピー。 | `apps/web/src/routes/index.tsx:319-337` |

主な操作（input タブ）:
- 日付・始業/終業/休憩の入力（ヘッダ。`apps/web/src/routes/index.tsx:162-187`）。
- 取引先追加/削除、タスク行追加/削除（`ProjectBlock` / `TaskRow`。`apps/web/src/routes/index.tsx:224-237`）。
- 振り返り入力（`ReflectionSection`。`apps/web/src/routes/index.tsx:238-245`）。
- テンプレ保存（localStorage、`saveTemplate`。`:102-106`）/ 日報保存（DB、`saveReport`。`:108-121`）。
- 入力は 500ms デバウンスで sessionStorage に自動保存（`:95-100`）。

## 使用コンポーネント（画面 → 主な子コンポーネント）

| 画面 | 主な子コンポーネント | 場所 |
|---|---|---|
| `/`（HomePage） | `ProjectBlock` / `TaskRow` / `ReflectionSection`、UI 系（`Input`/`Button`/`Label`/`CopyButton`/`CellRow`） | `apps/web/src/components/report/`, `apps/web/src/components/ui/` |
| `/timesheet`（TimesheetPage） | `MonthlyTimesheetTable`、`Button` | `apps/web/src/components/report/MonthlyTimesheetTable.tsx` |
| `/attendance`（AttendancePage） | `AttendanceTable`、`Button` | `apps/web/src/components/report/AttendanceTable.tsx` |

根拠: 各ルートの import 文（`apps/web/src/routes/index.tsx:3-15`、`timesheet.tsx:3-6`、`attendance.tsx:3-6`）、コンポーネント実在は `apps/web/src/components/` 配下で確認。

## アクセス権についての補足

- 現状、認証・認可の仕組みは一切実装されていない（`docs/02_users.md:3-19`）。`_authed` レイアウトやログイン/登録ルートは存在しない（`apps/web/src/routeTree.gen.ts` に該当ルートなし）。
- したがって全画面・全操作が無認証で利用可能。アクセス権列はすべて「制限なし（認証未実装）」。
- 本番 VPS デプロイ時に外部レイヤ（リバースプロキシ等）でアクセス制御がある可能性はアプリコードからは判断できない（`docs/02_users.md:39`、※未確認）。

## 未確認事項

- 日報の「削除」UI は確認できない。サーバ関数 `deleteReportFn` / `reportStorage.delete` は存在するが、画面からの結線は未確認（`docs/00_user_features.md:64`）。
- 各画面内コンポーネント（`MonthlyTimesheetTable` / `AttendanceTable` / `ProjectBlock` / `TaskRow` / `ReflectionSection`）の詳細な表示項目・計算は本ファイルでは実装行まで未読のため、概要のみ記載（※詳細は各コンポーネントファイル参照）。
