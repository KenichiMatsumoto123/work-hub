# テスト 敵対的レビュー結果（Phase 6 Round 1）

- **対象**:
  - `apps/web/src/server/report-normalize.test.ts`
  - `apps/web/src/server/functions/reports.test.ts`
  - `apps/web/src/server/functions/reports-constraints.integration.test.ts`
  - `apps/web/src/server/functions/reports-common.integration.test.ts`
  - `docs/設計/実績0hの保存/_review/test/red-phase-evidence.md`
- **レビュー日時**: 2026-08-16
- **方式**: 敵対的較正・3レーン並列（A: 欺瞞性 / B: 仕様対応 / C: セキュリティと証拠）。Adversary は fresh context・Read 専用。findings は司令塔が disk に保存
- **Phase 7（人間レビュー）**: 実施
- **人間判断**: 観点表 1章の本記載をスキップ（2026-08-16）。実装計画 5.5 の新規結合はコード化しない。マトリクスの N/A はこれを示す
- **総合判定**: FAIL

## サマリー

| Severity | 件数 |
|---|---|
| Critical | 0 |
| Major    | 2 |
| Minor    | 7 |

### Critical / Major findings 見出し一覧

- **FIND-B-01**: AC-Z05 単体が `value: 0` を要求し、分類表の `-0` と矛盾する（レーンA FIND-A-02 を統合。severity は高い方）
- **FIND-C-01**: 「全件 FAIL」マーカーが、PASS する新規 AC-Z14 を regression に編入して成立している

## 設計書 受け入れ条件 × テスト 対応マトリクス

凡例：✅ 対応テストあり / ⚠️ 部分的・不十分 / ❌ 未対応 / N/A 本テストの責務外（人間判断で 5.5 スキップ）

| 設計書 受け入れ条件 | 該当行 | 対応テスト | 状況 |
|---|---|---|---|
| AC-Z01 `"0"` / `"0.0"` / `"0h"` を別ケースで保存し `hours="0.00"` | 設計書「0h の記録」 | 単体 `report-normalize.test.ts:117-127` が 3 表記を別 `it`。保存経路は 5.5 スキップ | ✅ |
| AC-Z02 `"0.004"` → `"0.00"` | AC-Z02 | 単体 `:130` ＋ `reports-constraints.integration.test.ts:224` | ✅ |
| AC-Z03 `"0.0000001"` → `"0.00"` | AC-Z03 | 単体 `:136` ＋ constraints `:225` | ✅ |
| AC-Z04 `"0x10"` → `"0.00"` | AC-Z04 | 単体 `:131` ＋ `reports-common.integration.test.ts:364-377` | ✅ |
| AC-Z05 `"-0"` → 対象行（parseFloat は `-0`） | AC-Z05／R-2 分類表 | 単体 `:135` が `value: 0` を要求し分類表と矛盾 | ❌ |
| AC-Z06 数値型 `0` | AC-Z06 | 単体 `:142-144`。保存経路は 5.5 N/A | ✅ |
| AC-Z09b 予定h `"8"` ＋実績 `"0"` | AC-Z09b | Group B なし | N/A |
| AC-Z07 空・空白・`"abc"` は実績もマスタも作らない | AC-Z07 | 判定1 ＋ 5-5（`'0'` 除外済み） | ✅ |
| AC-Z08 負数 3 種は実績もマスタも作らない | AC-Z08 | 判定2 ＋ 5-5 の `'-3'`。`'-0.004'` / `'-Infinity'` の保存は 5.5 N/A | ✅ |
| AC-Z09 予定h のみ | AC-Z09 | 固有ケースなし | N/A |
| AC-Z10 0h マスタ解決 | AC-Z10 | なし | N/A |
| AC-Z10b 三者空＋`"0"` | AC-Z10b | なし | N/A |
| AC-Z11 再保存 7.5→0 | AC-Z11 | なし | N/A |
| AC-Z12 再保存 0→空 | AC-Z12 | なし | N/A |
| AC-Z13 0h＋256 文字で親テンプレート | AC-Z13 | `reports.test.ts:355-367`。DB 非更新は 5.5 N/A | ✅ |
| AC-Z14 空欄＋300 文字は保存成功 | AC-Z14 | 単体 AC-48 ＋ `reports.test.ts:369-379`（`.not.toBe`）＋ 5-12 | ✅ |
| AC-Z15 `"24.005"` は失敗 | AC-Z15 | 判定3 ＋ constraints `:222` | ✅ |
| AC-Z16 4 行で 3 件・合計 10.18 | AC-Z16 | `reports-common.integration.test.ts:688-697` | ✅ |
| AC-Z17 直 INSERT `0` | AC-Z17 | なし | N/A |
| AC-Z18 直 INSERT `-0.01` 拒否 | AC-Z18 | なし | N/A |
| AC-Z18b 直 INSERT `-0.004` 許可 | AC-Z18b | アプリ経路 skip は Z08 単体。直 INSERT は N/A | N/A |
| AC-Z19 制約名入れ替え | AC-Z19 | なし | N/A |
| AC-Z20 予定側制約残存 | AC-Z20 | なし | N/A |

## Findings（Critical / Major）

### FIND-B-01: AC-Z05 単体が `value: 0` を要求し、分類表の `-0` と矛盾する

- **観点 / レーン**: 受け入れ条件との対応（レーンB）／トートロジー・過剰束縛の周辺（レーンA FIND-A-02 を統合）
- **重大度**: Major（レーンA は Minor、レーンB は Major → 高い方を採る）
- **ファイル**: `apps/web/src/server/report-normalize.test.ts:129-140`（`['-0', 0]`）。対比: 設計書 R-2 分類表 `"-0"` 行（parseFloat 列は `-0`）、本文「`-0` の扱い」、`report-normalize.ts:40`（`value` は parseFloat の結果）
- **問題**: `parseFloat("-0")` は `-0`。判定 2 を `value < 0` にした正規実装は `{ kind: 'target', value: -0 }` を返す。Vitest `toEqual` は `+0` と `-0` を区別するため、`toEqual({ kind: 'target', value: 0 })` は正しい返却で FAIL する。Phase 8 は仕様にない `+0` 正規化（`value + 0` や `Object.is` 分岐）を入れさせられる
- **影響**: 分類表・型コメントとテスト期待値が食い違い、実装が仕様外の符号ゼロ変換を固定する。AC-Z05 の保存結果 `"0.00"` 自体は `String(-0)==="0"` で満たせるが、単体の期待値が仕様の parseFloat 結果を否定している
- **推奨対応**: 期待値を `{ kind: 'target', value: -0 }` にする（`it.each` なら `['-0', -0]`）。`kind==='target'` と `Object.is(result.value, -0)` の併用でもよい。`value: 0` のままにしない
- **戻り先**: Phase 5

### FIND-C-01: 「全件 FAIL」マーカーが、PASS する新規 AC-Z14 を regression に編入して成立している

- **観点 / レーン**: Red Phase log の妥当性（レーンC・MC-5）／AC-Z14 の弱い assert（レーンA FIND-A-01・レーンB FIND-B-04 を本文に統合）
- **重大度**: Major
- **ファイル**: `docs/設計/実績0hの保存/_review/test/red-phase-evidence.md:10-12,28-32` / `apps/web/src/server/functions/reports.test.ts:369-378`
- **問題**: マーカーは `new-feature-tests: FAIL（14 tests・全件期待値不一致）` と書く。14件（単体 0 系 12 ＋ AC-Z13 の 2）は現行 `value < 0.005` skip に対する期待値不一致で成立する。しかし AC-Z14 は本機能の新規 AC テストであり、現行実装で PASS する。証拠はこれを「regression-baseline / 非矛盾」へ移し、「トートロジーとして書き直していない」とだけ記す。さらに AC-Z13 は受信 `検証エラーの経路で DB に触れました: transaction` を書いたが、AC-Z14 の受信は書いていない。実装は `messageOf` のあと `expect(message).not.toBe(長さ超過テンプレート)` のみ。DB モックが `transaction` で throw しても、成功しても、別文言でも PASS する。設計書 AC-Z14 の「保存に成功する」は観測していない
- **影響**: Phase 6 が「新規は全件 Red」と読むと、PASS 新規のトートロジー疑いがマーカー上消える。Green 後も同じ `.not.toBe` が残り、長さ超過経路へ落ちた実装を「長さ超過テンプレートと完全一致しない別メッセージ」で通す
- **推奨対応**: マーカーを「新規・書き換え 15件中 14 FAIL / 1 PASS（AC-Z14）」と書き直す。AC-Z14 の受信メッセージを証拠に列挙する。テストは「長さ超過テンプレートでない」ではなく、現行の受信（DB モック例外 `検証エラーの経路で DB に触れました: transaction`）を固定する（検証を通過して DB に触れた＝長さ超過では止まっていない）
- **戻り先**: Phase 5

## Minor（1行のみ）

- FIND-B-02: 2-7 の describe 標題が失効した AC-30・AC-46 を残している（`reports-constraints.integration.test.ts:217`）
- FIND-B-03: 単体ファイルヘッダが AC-30・AC-46 を根拠として列挙したまま（`report-normalize.test.ts:4-5`。7 行目では失効と書いてあり自己矛盾）
- FIND-B-05: 5-5 が AC-Z07 の `projects` 非作成を assert していない（`reports-common.integration.test.ts:254-264`）
- FIND-C-02: `npm run test` の vitest 生出力が証拠に無く、12件単体はケース名列挙のみ（`red-phase-evidence.md:14-22`）
- FIND-C-03: 観点表 0章の該当トリガー表が PII/認可を「非該当」とだけ書き、理由列が無い（`観点表.md:20-22`）
- FIND-C-04: `impl-files-unchanged` が git status の引用なし（`red-phase-evidence.md:12`）
- FIND-A-01 / FIND-B-04: AC-Z14 の `.not.toBe` は FIND-C-01 に統合（Major）

## レビュー観点ごとの判定

| 観点 | レーン | 判定 | 裏付け |
|---|---|---|---|
| トートロジー検出 | A | PASS | 0 系は現行 skip との kind 不一致。AC-Z13 はモック文言を期待値にしていない。AC-Z14 の現行 PASS は FIND-C-01 |
| 実装詳細の過剰束縛 | A | PASS | 期待値は分類表・親テンプレート・`numeric(4,2)` 表示形。内部定数への束縛なし |
| 受け入れ条件との対応 | B | FAIL | Group B 内の ❌ は AC-Z05（FIND-B-01）。5.5 N/A は人間判断 |
| エッジケース・例外系の網羅 | B | PASS | Group B 単体に 0 / -0 / 微小値 / 上限 / 空 / 負数 / Infinity。再保存・直 INSERT は N/A |
| セキュリティ・品質観点 | C | PASS | PII/認可は設計書で非該当。`requireSession` 静的検証は維持。helpers 経由・TRUNCATE なし |
| Red Phase log の妥当性 | C | FAIL | 14件の期待値不一致は成立。PASS する新規 AC-Z14 を regression に編入して「全件 FAIL」としている（FIND-C-01） |

---

# テスト 敵対的レビュー結果（Phase 6 Round 2）

- **対象**: Round 1 の Major 修正差分（`report-normalize.test.ts` の `['-0', -0]`、`reports.test.ts` の AC-Z14 受信固定、`red-phase-evidence.md` マーカー改訂）
- **レビュー日時**: 2026-08-16
- **方式**: 差分レビュー・3レーン並列。must-catch 毎周実施
- **Phase 7（人間レビュー）**: 実施
- **総合判定**: PASS（Critical 0・Major 0）

## サマリー

| Severity | 件数 |
|---|---|
| Critical | 0 |
| Major    | 0 |
| Minor    | 2（本 Round 新規。Round 1 の Minor は記録のまま） |

### 前回 Major の解消

| ID | 判定 | 根拠 |
|---|---|---|
| FIND-B-01 | **解消** | `report-normalize.test.ts:135` が `['-0', -0]`。期待 `{ kind: 'target', value: -0 }` は分類表の parseFloat 列と一致。Vitest `toEqual` は `+0`/`-0` を区別する |
| FIND-C-01 | **解消** | 証拠マーカーが「15 件中 14 FAIL / 1 PASS（AC-Z14）」。AC-Z14 受信を列挙。テストは `検証エラーの経路で DB に触れました: transaction` の完全一致。`.not.toBe` は削除済み |

## マトリクス差分（AC-Z05）

| 設計書 受け入れ条件 | 対応テスト | 状況 |
|---|---|---|
| AC-Z05 `"-0"` → 対象行（parseFloat は `-0`） | `report-normalize.test.ts:135-139`。保存経路は 5.5 N/A | ✅ |

## Findings（Critical / Major）

なし。

## Minor（1行のみ・本 Round）

- FIND-A2-01: AC-Z14 の期待値がモックのメソッド名 `transaction` に完全一致しており、第一到達が `db.insert` 等へ変わる正当なリファクタで偽 FAIL する（`reports.test.ts:375-377`）
- FIND-C2-01: ファイル先頭コメントが「DB に触れる実装はここでメッセージ不一致として落ちる」のまま（`reports.test.ts:9-11`）。AC-Z14 だけは触れたメッセージを期待値にしている

## レビュー観点ごとの判定（Round 2）

| 観点 | レーン | 判定 | 裏付け |
|---|---|---|---|
| トートロジー検出 | A | PASS | `-0` は分類表の parseFloat。AC-Z14 は検証通過後の DB 到達センチネル。モック業務値の echo ではない |
| 実装詳細の過剰束縛 | A | FAIL（Minor のみ） | FIND-A2-01。Critical/Major なし |
| 受け入れ条件との対応 | B | PASS | Group B の ❌ だった AC-Z05 は ✅。5.5 N/A は人間判断 |
| エッジケース・例外系の網羅 | B | PASS | `"-0"` が判定4に残る。再保存・直 INSERT は N/A |
| セキュリティ・品質観点 | C | PASS | PII/認可非該当。`requireSession` 維持。helpers 経由 |
| Red Phase log の妥当性 | C | PASS | 14 FAIL / 1 PASS を分離。結合は未実行と明記 |

## must-catch（Round 2）

| # | 判定 |
|---|---|
| MC-1 | PASS |
| MC-2 | PASS（PII 非該当） |
| MC-3 | PASS（認可非該当。親 requireSession 維持） |
| MC-4 | PASS |
| MC-5 | PASS |
| MC-6 | PASS（Group B 内 ❌/⚠️ なし） |
| MC-9 | PASS |
