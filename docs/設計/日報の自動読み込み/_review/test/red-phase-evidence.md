# Red Phase Evidence

- 機能：日報の自動読み込み
- 実施日時：2026-08-16 09:09 UTC（Phase 6 Round 1 修正後の再検証）
- テスト作成：test-builder（fresh context・Composer 2.5）／Red Phase 検証：司令塔が独立再実行
- 実行コマンド：`npm run test`（リポジトリルート）

## マーカー

- new-feature-tests: FAIL（89 tests・全件期待値不一致またはスタブ throw。import エラー一括 FAIL なし）
- new-feature-allowed-pass: PASS（8 tests。定数 5 + `dateMissing` ソース断言 + AC-L53 ソース断言 + `defaultDailyReport(date)` 引数指定）
- regression-baseline: PASS（226 tests）
- impl-files-unchanged: 確認済（`emptyReport` / `applyLoadSuccess` / `startLoad` は throw のみ。`rowToReport` / `saveReportFn` / `index.tsx` 本体は未変更）

合計: 89 failed | 234 passed (323) = 新規 FAIL 89 + 許容 PASS 8 + 既存 PASS 226

## 新規テストの失敗内訳

| テストファイル | Fail件数 | 主な失敗理由 |
|---|---|---|
| `apps/web/src/lib/report-load.test.ts` | 40 / 45 | スタブ throw |
| `apps/web/src/lib/report-load-flow.test.ts` | 24 / 24 | スタブ throw / `onDateChange` が confirm せず `none` |
| `apps/web/src/lib/time-utils.test.ts`（追記） | 4 | UTC `toISOString` / AC-L05 ソース |
| `apps/web/src/lib/defaults.test.ts` | 2 / 3 | `getToday` 未使用、`toISOString` 残存。引数指定 1 件は PASS |
| `apps/web/src/lib/storage.test.ts` | 2 | `getByDate` が catch して `null` |
| `apps/web/src/routes/index.report-load.test.ts` | 11 / 13 | AC-L60/L62 の禁止文字列が残存。`dateMissing` と AC-L53 ソース断言は PASS |
| `apps/web/src/server/functions/reports.test.ts`（追記） | 6 | AC-L13 middleware 未付与、AC-L12 が throw（`null` 期待） |

※スタブ最小実装：`report-load.ts` の振る舞い関数は throw（`onDateChange` のみ固定 `{ action: 'none' }` で Red 維持）。`applyLoadSuccess` / `emptyReport` の null 分岐・`defaultDailyReport` 合成は除去済み（FIND-P6-C-001）。

## 既存テスト（リグレッション）の通過確認

全 226 件 PASS。`saved-msg.test.ts` は未変更。

## 結合(DB込み)

`reports-get-by-date.integration.test.ts` は作成済み。`npm run test` 対象外。

## 401 実形状

`unauthorized-error-shape.md`。AC-L44 (a)(b)(c) で足りる。設計書追記不要。

## 補足

- Phase 6 Round 1 修正後の再検証
- Playwright 未作成（Phase 10）
- `getReportByDateFn` の `requireSession` は Red 優先で未付与
