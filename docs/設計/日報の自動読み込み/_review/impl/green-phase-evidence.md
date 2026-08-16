# Green Phase Evidence

- 機能：日報の自動読み込み
- 実施日時：2026-08-16 09:50 UTC
- 実装：impl-builder（fresh context・Composer 2.5）／ゲート検証：司令塔が独立再実行

## マーカー

- target-feature-tests: PASS（99 tests。Red Phase の 91 FAIL + 許容 PASS 8 がすべて Green）
- regression-baseline: PASS（226 tests。スイート合計 325 = 99 + 226）
- integration: PASS（77 tests。うち本機能 AC-L10 / AC-L11 の 2 + 既存 75）
- test-files-unchanged: **例外あり**（下記「テストの最小修正」）

## ゲート確認

| チェック | コマンド | 結果 |
|---|---|---|
| 単体 + 結合（内部） | `npm run test` | PASS（325 tests / 16 files） |
| 結合（DB込み） | `DATABASE_URL='postgres://workhub:workhub_dev@127.0.0.1:5432/workhub_test' npm run test:integration` | PASS（77 tests / 7 files） |
| Lint | `npm run lint` | 該当なし（本リポジトリ未導入。`check-types` で代替） |
| 型チェック | `npm run check-types` | PASS |
| ビルド | `npm run build` | PASS |

## Phase 7 findings の対応記録

| FIND-ID | 対応方針（Phase 7 判定） | 対応内容 | 状態 |
|---|---|---|---|
| （指定なし） | Phase 8 で対応する Critical/Major は無し。Minor は記録のみ | テストは変えない方針で実装。下記の 1 断言のみ設計優先で修正 | — |

## 実装内容（impl-builder）

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `apps/web/src/lib/time-utils.ts` | 変更 | `getToday` を `Intl` + `Asia/Tokyo` + `formatToParts`。ファイル末尾に配置（AC-L05 の slice 断言） |
| `apps/web/src/lib/defaults.ts` | 変更 | `defaultDailyReport` が `getToday()` を使う |
| `apps/web/src/lib/report-load.ts` | 変更 | dirty / startLoad / onDateChange / 401 / stale / 操作可否ヘルパー |
| `apps/web/src/server/functions/fetch-report-by-date.ts` | 新規 | `rowToReport`（移動のみ）と `fetchReportByDate`。invalid は DB 非接触で null |
| `apps/web/src/server/functions/reports.ts` | 変更 | `getReportByDateFn`（`requireSession` + 上記 fetch）。`rowToReport` は import |
| `apps/web/src/lib/storage.ts` | 変更 | `getByDate` は例外を再throw。null に吞まない |
| `apps/web/src/routes/index.tsx` | 変更 | 自動読み込み・バナー・disabled・`useBlocker`・`beforeunload`。オートセーブ/テンプレ削除 |
| `apps/web/src/test/vitest.setup.ts` | 新規 | Vitest 未変換 createServerFn を避け、`getReportByDateFn` を `fetchReportByDate` に委譲 |
| `apps/web/vitest.config.ts` | 変更 | 上記 setup を読み込み |
| `apps/web/vitest.integration.config.ts` | 変更 | 結合でも同 setup を読み込み |

## テストの最小修正（Phase 3 設計との矛盾解消）

実装を設計書 startLoad step 8 / AC-L15（成功時は `data = baseline = applyLoadSuccess`。マージ禁止）どおりにしたところ、次が両立しなかった。

- ファイル: `apps/web/src/lib/report-load-flow.test.ts`
- テスト: `await 前に data.date だけ要求日付へ更新し loadStatus は loading`
- 同期フェーズ（`onBeforeFetch`）の `note === '保持'` は設計どおり PASS
- 成功後の `result.data.note === '保持'` は、`makeSingleBlockReport` の note が空のため **設計どおり `''`**。ここをマージで通すと、日付変更 confirm 後に前日の未保存 note で保存済み日報を上書きする製品バグになる

Phase 3 の人間承認済み設計を優先し、成功後の期待を `saved.note` に合わせた。あわせて同ファイルの `DateChangeResult` 未ナローイング（`check-types` 8 件）を `expectStartLoad` で絞った。期待する製品挙動は変えていない。

## 補足

- 前提タスクのブロックなし（スキーマ変更なし。`db:push` はテスト DB 初期化のため司令塔が実施）
- Playwright / E2E は Phase 10
- `getAllReportsFn` は読み込みに使っていない
- 結合(DB込み) は `report-db-helpers.ts` 経由。TRUNCATE していない
- `saveReportFn` / `isValidReportStructure` / 工数・勤怠画面は未変更
- Vitest は createServerFn を変換しないため、handler がオブジェクトを返すと `result.result` が undefined になる。本番（Vite プラグイン変換後）は `next({ result })` で `null` / 行ありとも正しい。setup のラッパはテスト専用

---

## Phase 9 リファクタ記録

- 実施日時：2026-08-16 09:54 UTC
- 判定：**コード変更あり（3 件採用）**

### fallow（advisory）

- 実行：`npx fallow audit --base 15f5b82 --workspace apps/web` および `inspect`（`report-load.ts` / `index.tsx` / `fetch-report-by-date.ts`）／ `npx fallow dupes --workspace apps/web`
- 検出 → 採用 / 見送り

| 検出 | 観点 | 採否 | 理由 |
|---|---|---|---|
| unused export `storage` / `session`（`storage.ts`） | 不要コード削除 | **採用** | オートセーブ・テンプレ廃止後の消費者が無い |
| unused export `DAY_NAMES` | 不要コード削除 | 見送り | 本機能の変更外。既存の曜日定数 |
| unused dependency `zod` | 不要コード削除 | 見送り | 本機能の変更外 |
| `checkUnauthorizedValue` 複雑度 HIGH | 責務分離 | 見送り | AC-L44 のネスト走査そのもの。分割は過剰抽象 |
| `HomePage` 複雑度 | 責務分離 | 一部採用 | 初期状態の重複だけ解消。タブ UI の切り出しは既存画面の責務で本機能スコープ外 |
| `resolveMastersAndInsertEntries` 複雑度 | 責務分離 | 見送り | `saveReportFn` 経路。本機能で未変更 |
| dupes（schema / timesheet / attendance） | 重複削除 | 見送り | 本機能の変更外 |

### 5観点の人手点検（本機能の差分）

| 観点 | 結果 |
|---|---|
| 重複削除 | `createInitialLoadState` をマウント時 `startLoad` と共有。`isReportDirty` の二重呼び出しを `dirty` に集約 |
| 命名改善 | `staleResult` の未使用引数を削除 |
| 責務分離 | 読み込みロジックは `report-load.ts` のまま。画面は呼び出し層 |
| 抽象度の調整 | `emptyReport` / `shouldFetchReport` エイリアスは設計・テスト契約のため維持。`loadDeps` は `useMemo` のオブジェクトに変更（毎呼び出しで作らない） |
| 可読性向上 | 上記。`getToday` のファイル位置は AC-L05 のソース slice のため動かさない |

### 実施項目

1. `index.tsx`：初期状態の重複削除、`dirty` 集約、`loadDeps` を `useMemo`
2. `storage.ts`：未使用の `storage` / `session` を削除
3. `report-load.ts`：`staleResult` の未使用引数を削除

### ゲート再確認

| チェック | 結果 |
|---|---|
| `npm run test` | PASS（325） |
| `npm run test:integration` | PASS（77） |
| Lint | 該当なし |
| `npm run check-types` | PASS |
| `npm run build` | PASS |
