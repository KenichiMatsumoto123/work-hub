# Green Phase Evidence

- 機能：実績0hの保存
- 実施日時：2026-08-16 06:56 UTC
- 実装：impl-builder（fresh context）／ゲート検証：司令塔が独立再実行

## マーカー

- target-feature-tests: PASS（15 tests：単体 0 系 12 + AC-Z13 の 2 + AC-Z14 の 1）
- regression-baseline: PASS（211 tests。スイート 226 = 15 + 211）
- test-files-unchanged: 確認済（`git diff HEAD~1 -- '*test.ts'` 空。実装コミット `c770e0f` は `report-normalize.ts` と `schema/tasks.ts` のみ）

## ゲート確認

| チェック | コマンド | 結果 |
|---|---|---|
| 単体 + 結合（内部） | `npm run test` | PASS（226 tests / 11 files） |
| 結合（DB込み） | `DATABASE_URL=.../workhub_test npm run test:integration` | PASS（75 tests / 6 files） |
| Lint | `npm run lint` | 該当なし（本リポジトリ未導入。`check-types` で代替） |
| 型チェック | `npm run check-types` | PASS |
| ビルド | `npm run build` | PASS |

## スキーマ反映（適用順 8.2）

司令塔が `workhub_test` を立てて `npm run db:push -- --force` を実行した。情報スキーマ:

| 制約名 | 定義 |
|---|---|
| `chk_hours_non_negative` | `CHECK ((hours >= (0)::numeric))` |
| `chk_planned_hours_positive` | `CHECK ((planned_hours > (0)::numeric))` |

`chk_hours_positive` は存在しない。

## Phase 7 findings の対応記録

| FIND-ID | 対応方針（Phase 7 判定） | 対応内容 | 状態 |
|---|---|---|---|
| FIND-B-02 ほか Minor | 文書化のみ | 実装・テストとも触っていない | 文書化のみ |

Phase 8 で対応する Critical/Major は無し。

## 実装内容（impl-builder）

| ファイル | 内容 |
|---|---|
| `apps/web/src/server/schema/tasks.ts` | `chk_hours_positive`（`hours > 0`）→ `chk_hours_non_negative`（`hours >= 0`） |
| `apps/web/src/server/report-normalize.ts` | 判定 2 を `value < 0` に。判定 4 は `0` 以上 `24.005` 未満。`value` は parseFloat のまま |

`saveReportFn` / 画面 / `report-generator.ts` / `MonthlyTimesheetTable` は未変更。

## 補足

- impl-builder 実行時この環境に PostgreSQL が無く、`db:push` は失敗した。スキーマファイルの変更は残していた。司令塔が PostgreSQL 16 を入れ、`workhub_test`（開発 DB 名 `workhub` ではない）へ push したうえで結合を再実行した
- バックフィル用の一括移行は入れてない
