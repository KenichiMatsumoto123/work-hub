# Red Phase Evidence

- 機能：実績0hの保存
- 実施日時：2026-08-16 06:32 UTC
- テスト作成：test-builder（fresh context）／Red Phase 検証：司令塔が独立再実行
- 実行コマンド：`npm run test`

## マーカー

- new-feature-tests: FAIL（14 tests・全件期待値不一致）
- regression-baseline: PASS（212 tests）
- impl-files-unchanged: 確認済（変更はテスト＋観点表＋E2E候補カタログのみ。`report-normalize.ts` / `reports.ts` / schema / UI は未変更）

## 新規・書き換えテストの失敗内訳

| テストファイル | Fail件数 | 主な失敗理由 |
|---|---|---|
| `apps/web/src/server/report-normalize.test.ts` | 12 | 現行 `classifyActualHours` が `value < 0.005` で skip。期待は `{ kind: 'target', value: … }`（AC-Z01 の `"0"` / `"0.0"` / `"0h"` 別ケース、`"0.004"` / `"0x10"` / `" 0"` / `"0.00"` / `"0,5"` / `"-0"` / `"0.0000001"` / `"0.000001"` / 数値 `0`） |
| `apps/web/src/server/functions/reports.test.ts` | 2 | AC-Z13。現行は `"0"` / `"0.004"` を skip するため長さ検証せず DB モックに到達。期待は親の長さ超過テンプレート完全一致。受信は `検証エラーの経路で DB に触れました: transaction` |

※スタブ最小実装方式：全件が期待値不一致 FAIL。import エラーは 0 件。
※実装関数をスタブに置き換えていない。現行実装（判定 2 が `value < 0.005`）に対する期待値不一致で Red を取った。

## 既存テスト（リグレッション）の通過確認

全 212 件 PASS（スイート全体 226 = FAIL 14 + PASS 212）。

うち本機能の書き換え後も現行実装で PASS するもの（regression-baseline / 非矛盾）:

- 判定 2 skip 3 件（`"-3"` / `"-0.004"` / `"-Infinity"`）。現行 `value < 0.005` でも skip
- AC-Z14 1 件（空欄 + 300 文字は長さ超過テンプレートではない）。現行でも空欄行は長さ検証しない（親 AC-48 の再確認）。トートロジーとして書き直していない
- 判定 1（NaN skip）・判定 3（24.005 以上 over）・名前長さ・認証静的検証など、下限変更と矛盾しない親テスト

## 結合(DB込み)の書き換え（`npm run test` 対象外）

`*.integration.test.ts` は本コマンドでは未実行。期待値だけ Phase 5 で直してある。現行実装に対する見込み:

| ファイル | 内容 | 現行実装での見込み |
|---|---|---|
| `reports-constraints.integration.test.ts` | `"0.004"` / `"0.0000001"` → `['0.00']`（AC-Z02・AC-Z03） | FAIL（現行は空配列） |
| `reports-common.integration.test.ts` 5-11 | AC-Z16：件数 3・合計 10.18・`0.00` 行を含む | FAIL（現行は件数 2） |
| 同 5-5 | `'0'` を skip リストから除外。残る空欄・非数・`'-3'` は件数 0 | PASS（regression） |
| 同 5-7 ② | `"0x10"` → `0.00`（AC-Z04） | FAIL（現行は件数 0） |

## 補足

- 前提タスクのブロック: なし
- ワーカーからの仮置き: なし
- **観点表 1章は未凍結。** Phase 7 = 実施のため人間本記載待ち。実装計画 5.5 の新規結合（AC-Z01 保存経路、Z07〜Z12、Z17〜Z20 等）はコード化していない
- クリティカルパス E2E の新規起案はしない（親 E2E-1〜7 を維持）。Playwright は未作成
- 表示モジュールのテストは新設していない
- E2E候補カタログに C-Z1〜C-Z3（#6〜#8）を追記済み
