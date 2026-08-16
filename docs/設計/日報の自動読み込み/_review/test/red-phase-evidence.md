# Red Phase Evidence

- 機能：日報の自動読み込み
- 実施日時：2026-08-16 08:53 UTC
- テスト作成：test-builder（fresh context・Composer 2.5）／Red Phase 検証：司令塔が独立再実行
- 実行コマンド：`npm run test`（リポジトリルート）

## マーカー

- new-feature-tests: FAIL（83 tests・全件期待値不一致またはスタブ throw。import エラー一括 FAIL なし）
- new-feature-constants: PASS（6 tests。設計書固定文言の定数。役割ファイルの「型定義・enum定数」例外として許容）
- regression-baseline: PASS（226 tests。既存 `saved-msg`・親保存経路・`requireSession` の既存 2 関数を含む）
- impl-files-unchanged: 確認済（変更はテスト＋シグネチャ追加＋スタブ最小実装＋`GUARD_DATES` 追記のみ。`rowToReport` / `saveReportFn` / `index.tsx` の実ロジックは未変更）

合計: 83 failed | 232 passed (315) = 新規 FAIL 83 + 定数 PASS 6 + 既存 PASS 226

## 新規テストの失敗内訳

| テストファイル | Fail件数 | 主な失敗理由 |
|---|---|---|
| `apps/web/src/lib/report-load.test.ts` | 39 / 44 | スタブ throw（dirty / 401 / alias / preventUnload）および `__STUB_EMPTY__` / `__STUB_APPLY__` の日付不一致 |
| `apps/web/src/lib/report-load-flow.test.ts` | 20 / 21 | スタブが状態遷移しない・throw。invalid/null 成功は `__STUB_EMPTY__` 日付不一致 |
| `apps/web/src/lib/time-utils.test.ts`（追記） | 4 | UTC `toISOString` のため AC-L01 不一致。AC-L05 ソース断言不一致 |
| `apps/web/src/lib/defaults.test.ts` | 2 | `getToday` 未使用、`toISOString().slice(0, 10)` が残存 |
| `apps/web/src/lib/storage.test.ts` | 2 | `getByDate` が catch して `null` に吞む |
| `apps/web/src/routes/index.report-load.test.ts` | 11 | オートセーブ／テンプレ文字列が `index.tsx` に残存 |
| `apps/web/src/server/functions/reports.test.ts`（追記） | 5 | `getReportByDateFn` に `requireSession` 未付与（Red 意図）。invalid date はスタブ throw（`null` 期待） |

※スタブ最小実装方式（2026-07-12 決定）：全件が期待値不一致 FAIL であること。import エラー型は残っていない。
※スタブ段階で PASS したテスト（定数・許容 6 件）:

- `DATE_CHANGE_CONFIRM` / `LEAVE_PAGE_CONFIRM` / `LOAD_STATUS_LOADING` / `LOAD_STATUS_ERROR` / `LOGIN_ON_401_HREF`（`report-load.test.ts` 5 件）
- `LEAVE_PAGE_CONFIRM`（`report-load-flow.test.ts` 1 件）

※司令塔が独立検証後、AC-L15 の `toEqual(emptyReport())` が `generateId` 揺れだけで落ち Green 不能だったため、test-builder に id 非依存のフィールド断言へ書き直させた。再実行後も FAIL 83 件。失敗理由は `__STUB_EMPTY__:` の日付不一致。

## 既存テスト（リグレッション）の通過確認

全 226 件 PASS。`saved-msg.test.ts` は未変更。`reports.test.ts` の既存 `saveReportFn` / `deleteReportFn` ケースは PASS。

## 結合(DB込み)

`apps/web/src/server/functions/reports-get-by-date.integration.test.ts`（AC-L10 / AC-L11）を作成済み。`report-db-helpers.ts` 経由。`GUARD_DATES` に観点表 1.0 の `2000-04-*` を追加。`npm run test` の対象外（`npm run test:integration`）。スタブ `getReportByDateFn` が throw するため Red で FAIL する想定。本ゲートの独立検証対象は `npm run test`。

## 401 実形状

`docs/設計/日報の自動読み込み/_review/test/unauthorized-error-shape.md`

AC-L44 の (a)(b)(c) で `requireSession` の `Response` 401 + `{ error: 'UNAUTHORIZED' }` を網羅できる。設計書追記は不要。

## 補足

- 前提タスクのブロック: なし
- 仮置き: なし
- Playwright は未作成（観点表 2 章は凍結のみ。Phase 10）
- `getReportByDateFn` の `requireSession` は Red 優先で未付与（AC-L13 は意図的 FAIL。Phase 8 で付与）
