# Red Phase Evidence

- 機能：実績0hの保存
- 実施日時：2026-08-16 06:42 UTC（Phase 6 Round 1 修正後の司令塔再実行）
- 初回検証：2026-08-16 06:32 UTC
- テスト作成：test-builder（fresh context）／Red Phase 検証：司令塔が独立再実行
- 実行コマンド：`npm run test`（vitest run）
- 結果サマリ：`Tests  14 failed | 212 passed (226)` / `Test Files  2 failed | 9 passed (11)`

## マーカー

- new-feature-and-rewritten: **15 件中 14 FAIL（期待値不一致）/ 1 PASS（AC-Z14）**
- regression-baseline: PASS（212 tests。AC-Z14 の 1 PASS を含む）
- impl-files-unchanged: 確認済。`git diff --stat 9add451 -- apps/web/src/server/report-normalize.ts apps/web/src/server/functions/reports.ts apps/web/src/server/schema` は空。現行 `classifyActualHours` は `value < 0.005` のまま（`report-normalize.ts:56`）

## 新規・書き換えテストの失敗内訳（14）

全件が期待値不一致。import エラーは 0 件。実装関数をスタブに置き換えていない。

| テストファイル | Fail件数 | 失敗理由（受信 → 期待） |
|---|---|---|
| `apps/web/src/server/report-normalize.test.ts` | 12 | 現行 `{ kind: 'skip' }` → `{ kind: 'target', value: … }`。対象: `"0"` / `"0.0"` / `"0h"`（AC-Z01 別ケース）、`"0.004"` / `"0x10"` / `" 0"` / `"0.00"` / `"0,5"` / `"-0"`（期待 value は `-0`。FIND-B-01 修正後）/ `"0.0000001"` / `"0.000001"` / 数値 `0` |
| `apps/web/src/server/functions/reports.test.ts` | 2 | AC-Z13。受信 `検証エラーの経路で DB に触れました: transaction` → 親の長さ超過テンプレート完全一致 |

## 新規だが現行実装で PASS するテスト（1）

| テスト | 受信 | 扱い |
|---|---|---|
| AC-Z14（`reports.test.ts`「実績h が空でタスク名が 300 文字の行は長さ超過メッセージでは失敗しない」） | `検証エラーの経路で DB に触れました: transaction`（FIND-C-01 修正後。長さ超過テンプレートではないことの観測＝検証通過して DB モックに到達） | **PASS**。空欄行は現行でも長さ検証しない（親 AC-48）。トートロジーとして書き直さず、受信を固定した。Phase 8 後も同じメッセージなら「空欄は長さ超過で止まらない」が維持される |

## 既存テスト（リグレッション）の通過確認

212 件 PASS（スイート 226 = FAIL 14 + PASS 212）。

うち下限変更と矛盾しないもの: 判定 2 skip 3 件（`"-3"` / `"-0.004"` / `"-Infinity"`）、判定 1・判定 3、名前長さ、`requireSession` 静的検証、AC-Z14。

## 結合(DB込み)の書き換え（`npm run test` 対象外）

未実行。未実行を PASS 扱いしていない。

| ファイル | 内容 | 現行実装での見込み |
|---|---|---|
| `reports-constraints.integration.test.ts` | `"0.004"` / `"0.0000001"` → `['0.00']` | FAIL（現行は空配列） |
| `reports-common.integration.test.ts` 5-11 | AC-Z16：件数 3・合計 10.18 | FAIL（現行は件数 2） |
| 同 5-5 | `'0'` を skip リストから除外 | PASS（残入力は現行でも skip） |
| 同 5-7 ② | `"0x10"` → `0.00` | FAIL（現行は件数 0） |

## 補足

- 観点表 1章の本記載は 2026-08-16 人間判断でスキップ。5.5 新規結合はコード化していない
- E2E 新規起案なし。候補カタログ C-Z1〜C-Z3（#6〜#8）追記済み
- Phase 6 Round 1 で直した点: FIND-B-01（`"-0"` の期待 value を `-0` に）、FIND-C-01（本証拠のマーカーと AC-Z14 の受信固定）
