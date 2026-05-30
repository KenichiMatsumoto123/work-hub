# 01. 背景・課題・目的・方針

## 背景・経緯

- 本アプリは元々、単一の HTML ファイルで動作する日報ジェネレーターだった。これを TanStack Start による本格的な Web アプリへ移行した経緯がある（`apps/web/docs/requirements.md:10`）。
- 開発元は株式会社アルマコ。社内向けの個人業務効率化ツールと推測される（※推測。リポジトリ内に明示的な企業向け公開記述はなく、`apps/web/docs/requirements.md:49,70` がアルマコ社内様式を参照していることから推定）。
- リポジトリ上のプロジェクト名は `work-hub`（ルート `package.json:2`）、設計ドキュメント上の名称は `work-report`（`apps/web/docs/requirements.md:7`）。本ドキュメント群ではコードに即して `work-hub` を正、`work-report` を内部名として扱う。

## 課題

ユーザーは以下3つの報告を毎日手入力しており、同一データを複数箇所へ重複入力する手間が発生していた（`apps/web/docs/requirements.md:16-20`）。

1. 日報（フリーテキスト形式）— プロジェクト/タスクごとの予定時間・実績時間・進捗率
2. プロジェクト別稼働報告（Excel）— 取引先ごとの月次工数管理表
3. 勤怠管理（Excel）— 会社への勤怠報告（12か月横並びの年間シート）

## 目的・基本方針

- 基本方針は **「1回の入力 → 3つの出力」**（`apps/web/docs/requirements.md:28`、UI 上の標語 `apps/web/src/routes/index.tsx:158`）。
- 1度の日報入力から、日報テキスト / プロジェクト別稼働報告 / 勤怠報告の3フォーマットを自動生成し、Excel セル等への貼り付けを容易にする。
- 自動計算ルール（`apps/web/docs/requirements.md:88-92`、実装は `apps/web/src/components/report/AttendanceTable.tsx`）:
  - 区分（稼/休）: タスク入力（勤務時間）があれば「稼」、なければ「休」。週末は「休」、週末に勤務があれば「休出」（`apps/web/src/components/report/AttendanceTable.tsx:45,64`）。
  - 勤務時間 / 遅早時間 / 残業時間 / 休出時間 / 深夜時間を自動計算（`apps/web/src/components/report/AttendanceTable.tsx:54-60`）。
  - Excel エクスポートは将来対応。現時点では Web 表示・コピーのみ（`apps/web/docs/requirements.md:92`）。

## 実装の進捗（設計ドキュメントとの対応）

`apps/web/docs/implementation-plan.md` のフェーズ定義に基づく現状。

- Phase 1（基盤構築 + 既存機能移植）: 入力画面と3出力タブが動作（`apps/web/docs/implementation-plan.md:9`）。
- Phase 2（DB + 日報永続化）: `daily_reports` テーブルと createServerFn による CRUD が実装済み（`apps/web/src/server/functions/reports.ts`）。月次表示（timesheet / attendance）も DB から取得（`apps/web/src/routes/timesheet.tsx:24`、`apps/web/src/routes/attendance.tsx:24`）。
- Phase 3 以降（認証 Better Auth / マスタ管理 / チーム機能）: 未着手（`apps/web/docs/implementation-plan.md:131,173-194,236-246`）。

## 設計意図と実装の乖離（重要）

`apps/web/docs/requirements.md` は users / teams / team_members / report_entries テーブル、Better Auth 認証、`/login` `/register` `/_authed/*` ルーティング、チーム共有機能を記載しているが、これらは **設計意図であり現状の実装には存在しない**。

- スキーマに users / teams / team_members / report_entries は存在しない（`apps/web/src/server/schema/` 配下で確認）。
- 認証は未実装。ルートは `/`, `/timesheet`, `/attendance` の3つのみ（`apps/web/src/routes/`、`apps/web/src/routeTree.gen.ts:18-28`）。
- 日報の実テーブルは `daily_reports` 単一で、入力内容全体を `raw_data`（jsonb）に丸ごと保持する設計（`apps/web/src/server/schema/reports.ts:13-31`）。requirements.md の report_entries（正規化テーブル）とは異なる。

本ドキュメント群は実コードで確認した実態を「現状の実装」として記述し、requirements.md / implementation-plan.md の内容は「将来構想（未実装）」として区別している。

## 未確認事項

- 「個人向け」という位置づけは現状実装（認証なし・単一ユーザー前提）からの推定（※推測）。社内での実運用形態・配布範囲は未確認。
- requirements.md の参照様式ファイル（`learning\工数入力システム\参考様式\...`）は本リポジトリ外であり、内容は未確認。
