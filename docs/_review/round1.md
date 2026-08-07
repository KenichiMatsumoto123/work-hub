# レビュー結果 ラウンド1

## 総合判定
PASS(軽微残あり)

全5ファイルとも「引き継ぎに信頼して使える」水準に達している。架空テーブル・架空カラムの参照はゼロ。「daily_reports のみ実使用・他10テーブル未配線」という最重要事実は grep で裏取りした結果、完全に正確だった（フロント型 `project.tasks` のヒットのみで、DB テーブルを参照するサーバ関数/UIは存在しない）。Mermaid 構文・全11テーブル網羅・画面3つ網羅も実体と一致。
ただし「推測表記の過不足」「根拠行番号のオフバイ」「ER 図ブロックと本文メモの制約記述の粒度差」に Major〜Minor が残るため、PASS ではなく PASS(軽微残あり) とする。Critical は無し。

## ファイル別判定

| ファイル | 判定 | 主要指摘 |
|---|---|---|
| docs/03_glossary.md | PASS(軽微残あり) | 区分判定/標準8hを「推測」扱いだが実体は1readで確定（MAJ-1）。`types.ts` 行番号オフバイ（MIN-1） |
| docs/04_er_diagram.md | PASS(軽微残あり) | tasks の check 制約 `chk_task_type_project` がER図ブロック内に未記載・本文メモのみ（MIN-2）。それ以外はカラム/型/FK/UQ/CHK 全一致 |
| docs/05_screens.md | PASS | 画面3つ・コンポーネント名・パス全一致。指摘なし（軽微情報のみ） |
| docs/06_screen_transitions.md | PASS | graph TD 構文妥当、遷移根拠一致。指摘なし |
| docs/07_tech_stack.md | PASS(軽微残あり) | Node「バージョン指定なし」の根拠 `package.json:9` が不適切（MIN-3）。ssr/scrollRestoration 出典帰属は正確 |

## 重大な指摘 (Critical)

なし。

特に厳しく検証した3点はいずれもクリア:
- 架空のファイル/テーブル/カラム参照: 検出ゼロ。全カラム名・型・precision/scale・check・unique を schema 実体（`reports.ts`/`master.ts`/`goals.ts`/`tasks.ts`/`budgets.ts`）と1件ずつ照合し一致を確認。
- 「daily_reports のみ実使用、他10テーブル未配線」: `apps/web/src/` 配下（schema 除く）を `clients|projects|tasks|goals|timeEntries|...` で grep。ヒットした9ファイルは全て `DailyReportData.projects[].tasks`（フロント型）への参照で、DB テーブルへのクエリ/import は `reports.ts` の `dailyReports` のみ。記述は正確。
- Mermaid erDiagram リレーション記法: `||--o{` 14本すべて構文妥当。自己参照 `tasks ||--o{ tasks` も成立。

## 中程度の指摘 (Major)

### MAJ-1: 「推測表記」の過剰使用 — AttendanceTable のロジックは1readで確定する事実
- 該当: `docs/03_glossary.md:44`（「週末勤務は『休出』（推測を含む詳細は AttendanceTable.tsx 参照）」）、同 `:95`（未確認事項「区分判定・勤務時間/残業/休出/深夜の各計算ロジックは本ファイルでは未読のため…（※一部推測）」）
- 事実: `apps/web/src/components/report/AttendanceTable.tsx` を read すると、区分判定は `:64`「`isWeekend ? (workHours > 0 ? '休出' : '休') : '稼'`」で確定。標準勤務8時間は `:10`「`const STANDARD_WORK_HOURS = 8`」、勤務時間 `:54`、遅早 `:56`、残業 `:57`、休出 `:58`、深夜 `:60` と全て実装行で確定できる。これは「1ファイル read で確定する事実を推測扱いしている」ケースに該当（レビュー観点2の禁止事項）。なお 01_background.md は既にこのロジックを行番号付きで断定記述しており（`01:22`）、03 の「未読・推測」とドキュメント間で整合が取れていない。
- 修正: 03_glossary の区分説明から「（推測を含む）」を削除し、`AttendanceTable.tsx:10,64,54-60` を根拠として断定記述に変更。`:95` の未確認事項からも当該行を削除（または「検証済み」に格下げ）。

## 軽微な指摘 (Minor / 情報提供)

### MIN-1: `types.ts` 引用行番号のオフバイ（精査の結果オフバイ無し＝誤検出取り消し）
- 該当: `docs/03_glossary.md:24`
- 事実: `types.ts` の Task 型で `plannedHours` `:5`、`actualHours` `:6` は正しく該当。実害なし。本項目は情報提供（誤検出の取り消し）。

### MIN-2: ER 図ブロック内に tasks の `chk_task_type_project` が未表現
- 該当: `docs/04_er_diagram.md:86-104`（tasks の erDiagram ブロック）
- 事実: 本文メモ `:179` では「check 制約 5本」と正しく列挙しているが、Mermaid ブロック内カラム注釈には `chk_task_type_project`（`type != 'project' OR project_id IS NOT NULL`、`tasks.ts:66-69`）の注釈が無く、ブロックと本文メモで制約数の見え方が食い違う。
- 修正: tasks ブロック末尾に「複合 CHK: project タスクは project_id 必須」を1行注記するか、本文メモに「ER図ブロックには単カラム CHK のみ記載」と但し書きを付す。

### MIN-3: Node.js「バージョン指定なし」の根拠行が不適切
- 該当: `docs/07_tech_stack.md:22`（根拠を `apps/web/package.json:9` とする）
- 事実: `apps/web/package.json:9` は `"start": "node serve.mjs"` で、「engines によるバージョン指定が無い」ことの根拠にならない。engines フィールドの不在自体が根拠。`:98`（未確認事項）では正しく書けている。
- 修正: `:22` の根拠を「engines 指定なし（両 package.json に engines 不在）。本番起動は `node serve.mjs`（`apps/web/package.json:9`）」と分離記述。

### MIN-4（情報提供）: 検証してクリアだった主要ポイント
- daily_reports 全カラム（`reports.ts:13-31`）→ ER図 `04:23-37` と完全一致。
- technology_tags：`name` len100 unique、`created_at` のみ（`master.ts:68-74`）→ ER図と一致。
- tasks.parent_task_id：`.references()` 無し（`tasks.ts:32`）→ ER図「FK制約なし」「※推測」と一致。
- task_technology_tags：複合 PK 未定義（`tasks.ts:74-85`）→ 未確認事項で適切に「※未確認」明示。
- effort_budgets/weekly_effort_budgets の unique index・month/week BETWEEN check → ER図・本文と一致。
- 画面網羅：Glob `routes/*.tsx`＝`__root/index/timesheet/attendance`、routeTree.gen.ts fullPaths `/ | /attendance | /timesheet` → 05 と完全一致。
- createServerFn 4関数と inputValidator 行（`reports.ts:42,60,99`）→ 03/06/07 と一致。
- 全ファイル末尾に「未確認事項」節あり、日本語、emoji はドキュメント地の文に不使用。

## 差し戻し指示 (Agent-A に渡す修正タスク)

1. **[Major] 03_glossary.md:44,95** — AttendanceTable の区分判定・標準8h・各時間計算は `AttendanceTable.tsx:10,54-60,64` を read すれば1readで確定する。「（推測を含む）」「未読のため一部推測」を削除し、行番号付きの断定記述に修正。01_background.md:22 と表現を揃えること。
2. **[Minor] 04_er_diagram.md:86-104 / 179** — tasks の複合 CHK `chk_task_type_project`（project必須）について、ER図ブロックと本文メモの制約数の食い違いを解消（ブロックに1行注記、または本文に但し書き）。
3. **[Minor] 07_tech_stack.md:22** — Node.js「バージョン指定なし」の根拠を `package.json:9`（start スクリプト）から「engines フィールド不在」に差し替え、起動コマンドの根拠と分離。

## 検証したファイル / 位置（証拠）

- スキーマ実体: `apps/web/src/server/schema/reports.ts:13-31`、`master.ts:12-74`、`goals.ts:5-26`、`tasks.ts:18-139`、`budgets.ts:14-75`、`index.ts:1-5`
- サーバ関数: `apps/web/src/server/functions/reports.ts:1-103`（dailyReports のみ import/操作）
- フロント型: `apps/web/src/lib/types.ts:1-34`、`defaults.ts:1-39`
- ルート: `apps/web/src/routes/__root.tsx:12-50`、`index.tsx`、`timesheet.tsx`、`attendance.tsx`、`routeTree.gen.ts:32-54,101`、`router.tsx:7`
- ロジック: `apps/web/src/lib/report-generator.ts:5-62`、`time-utils.ts:16-45`、`storage.ts:10-83`、`components/report/AttendanceTable.tsx:10,33-70`、`ProjectBlock.tsx:18-64`
- 設定/インフラ: `apps/web/package.json:1-36`、ルート `package.json:1-27`、`drizzle.config.ts:1-10`、`docker-compose.yml:1-22`、`apps/web/vite.config.ts:1-17`、`apps/web/src/server/db.ts:1-44`
- 実在確認: `scripts/check-db.mjs`・`scripts/wait-for-db.mjs`、`apps/web/serve.mjs`、`packages/shared/src/index.ts:1-2`、`docs/vps-deploy-commands.md`
- 整合性照合元: `docs/00_user_features.md:1-66`、`01_background.md:1-48`、`02_users.md:1-41`
