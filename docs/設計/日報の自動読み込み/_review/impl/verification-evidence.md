# Phase 10 実行検証証拠（Round 1）

- 機能：日報の自動読み込み
- 実施日時：2026-08-16 10:05 UTC
- 実行者：司令塔（独立実行）

## 実行検証結果

| チェック | コマンド | 結果 |
|---|---|---|
| 単体 + 結合（内部） | `npm run test` | PASS（325 tests / 16 files） |
| 結合（DB込み） | `DATABASE_URL='postgres://workhub:workhub_dev@127.0.0.1:5432/workhub_test' npm run test:integration` | PASS（77 tests / 7 files） |
| Lint | `npm run lint` | 該当なし（本リポジトリ未導入。`check-types` で代替） |
| 型チェック | `npm run check-types` | PASS（Date 固定ヘルパーの型を直したあと） |
| ビルド | `npm run build` | PASS |
| E2E（当該機能） | `npm run test:e2e` | PASS（E2E-L1〜L8 および L6b の 9 scenarios。初回は L5/L6/L6b が confirm 観測のデッドロックで FAIL → ハーネス修正後 PASS） |
| E2E（常設スイート） | `npm run test:e2e` | PASS（auth / daily-report / effort-normalize / smoke を含む全 31 tests） |
| テスト無改変 | `git diff -- apps/web/src/**/*.test.ts` 等 | Phase 10 中に単体・結合テストは未変更。Phase 8 で `report-load-flow.test.ts` の 1 断言を設計優先で直した例外は green-phase-evidence に記録済み |

## E2E コード化の記録

- コード化したシナリオ：E2E-L1, L2, L3, L4, L5, L6, L6b, L7, L8（`apps/web/e2e/daily-report-auto-load.test.ts`）
- 親 E2E：`effort-normalize.test.ts` に `waitForReportLoadSuccess`（AC-L63）。`daily-report.test.ts` は hydration＋成功完了待ち、テンプレ保存断言を「無いこと」に変更（AC-L61）
- 凍結仕様との差異：操作手順・期待結果は観点表 2 章どおり。技術詳細のみ次を補った（期待結果は変えていない）
  - 日付変更後は `report-load-status` が表示されてから消えるのを待つ（直前の ready の count=0 を誤認しないため）
  - confirm は `dialog` を先に待ち、`dismiss` してから `fill`/`click` の完了を待つ（Playwright の click 完了待ちとネイティブ confirm のデッドロック回避）

---

# Phase 10 実行検証証拠（Round 2）

- 機能：日報の自動読み込み
- 実施日時：2026-08-16 10:13 UTC
- 実行者：司令塔（独立実行）
- 対象差分：`startLoad` の resolve 401 検出と `checkUnauthorizedValue` の文字列判定（FIND-001）

## 実行検証結果

| チェック | コマンド | 結果 |
|---|---|---|
| 単体 + 結合（内部） | `npm run test` | PASS（325 tests / 16 files） |
| 結合（DB込み） | `DATABASE_URL='postgres://workhub:workhub_dev@127.0.0.1:5432/workhub_test' npm run test:integration` | PASS（77 tests / 7 files） |
| Lint | `npm run lint` | 該当なし |
| 型チェック | `npm run check-types` | PASS |
| ビルド | `npm run build` | PASS |
| E2E（当該機能） | `npm run test:e2e` | PASS（9 scenarios） |
| E2E（常設スイート） | `npm run test:e2e` | PASS（全 31 tests） |
| テスト無改変 | 単体・結合テスト | FIND-001 修正でもテストファイルは未変更 |
