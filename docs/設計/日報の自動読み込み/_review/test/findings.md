# 観点表 敵対的レビュー結果（Round 1）

- 対象: `docs/設計/日報の自動読み込み/_review/test/観点表.md`
- レビュー日時: 2026-08-16 08:26
- 方式: AI起案の網羅性を疑う。3レーン並列（網羅性／期待値・実現可能性／クリティカルパス選定・仮置き）
- モデル: Composer 2.5
- 総合判定: FAIL

## サマリー

| Severity | 件数 |
| -------- | ---- |
| Critical | 0    |
| Major    | 12   |
| Minor    | 5    |

重複は統合した。元 ID を括弧に残す。

## Findings

### Critical

なし

### Major

#### F-VT-001: AC-L51 の勤怠管理リンクが E2E に無い
- **観点 / レーン**: 網羅性（レーンA）／元 F-VT-A-001。レーンC Minor と同趣旨
- **該当箇所**: 2.2 E2E-L6、2.1 セレクタ、設計書 AC-L51
- **問題**: AC-L51 は「工数管理」「勤怠管理」の両方。観点表は工数管理のみ。
- **影響**: `/attendance` 向け confirm の回帰が Phase 10 で検知されない。
- **推奨対応**: E2E-L6b または L6 拡張で勤怠管理を追加。2.1 に `getByRole('link', { name: '勤怠管理' })`。
- **仕様決定の要否**: 不要

#### F-VT-002: 「入力不正はカタログ」と 3 章の内容が不一致
- **観点 / レーン**: 網羅性（レーンA）／元 F-VT-A-002
- **該当箇所**: 2 章マッピング 89 行、3 章カタログ
- **問題**: マッピングは空・不正日付をカタログとするが、3 章は「空にして保存」のみ。AC-L35（不正日付 UI）の行き先が無い。
- **影響**: AC-L35 が追跡不能になる。
- **推奨対応**: 2 章を「空日付保存はカタログ、不正日付 UI は結合内部 5.3.4」と分離する。
- **仕様決定の要否**: 不要

#### F-VT-003: AC-L12 が 1 章（結合DB込み）に実ケースとして載っている
- **観点 / レーン**: 網羅性（レーンA）／実現可能性 Minor と同趣旨／元 F-VT-A-003
- **該当箇所**: 1 章 75 行、実装計画 5.3.2
- **問題**: AC-L12 は結合内部。1 章に載せると test-builder が `*.integration.test.ts` を書く誤経路が開く。
- **推奨対応**: 1 章は該当なし（5.3.2 へ委譲）。1 章の実ケースは AC-L10/L11 のみ。
- **仕様決定の要否**: 不要

#### F-VT-004: AC-L32（今日・行なし・空初期値）が E2E に無い
- **観点 / レーン**: クリティカルパス選定（レーンC）／元 F-VT-M01
- **該当箇所**: E2E-L3、設計書 AC-L32、要件 UC#1
- **問題**: オープン時に今日行が無ければ空初期値、が E2E 観測点 5 つで未検証。L3 は日付欄のみ。
- **影響**: 今日の空フォームが壊れても L1〜L7 が通る。
- **推奨対応**: E2E-L3 を拡張するか L8 を追加し、今日行なし Given で始業 `9:00`・取引先空などを断言する。
- **仕様決定の要否**: 不要

#### F-VT-005: E2E-L2 がシナリオ独立性と矛盾
- **観点 / レーン**: クリティカルパス選定（レーンC）／期待値（レーンB）／元 F-VT-M02、F-VT-B-007
- **該当箇所**: 2.0 規定 2、E2E-L2 Given
- **問題**: 「L1 の続き」を許容している。並列実行で前提が不定。
- **推奨対応**: Given を「`/` を開き成功完了待ち」の単一路線にする。
- **仕様決定の要否**: 不要

#### F-VT-006: E2E-L3 の対応 AC が AC-L30 になっている
- **観点 / レーン**: クリティカルパス選定（レーンC）／元 F-VT-M03
- **該当箇所**: E2E-L3
- **問題**: L3 は ready 後の日付欄のみ。AC-L30 は loading 中 disabled。カバレッジが表上で隠蔽される。
- **推奨対応**: 対応 AC を AC-L04（と拡張するなら AC-L32）にする。AC-L30 は結合内部へ委譲と明記。
- **仕様決定の要否**: 不要

#### F-VT-007: E2E-L5 の「API を呼ばない」は E2E で判定不能
- **観点 / レーン**: 期待結果の曖昧さ（レーンB）／元 F-VT-B-005
- **該当箇所**: E2E-L5、設計書 AC-L50
- **問題**: AC-L50 の E2E 必須は dialog 文言完全一致。API 非呼び出しは画面から判定できない。
- **推奨対応**: E2E 期待から API 非呼び出しを削除。結合内部 5.3.4 へ移す。
- **仕様決定の要否**: 不要（設計書の E2E 責務に合わせる）

#### F-VT-008: 始業・良かった点のセレクタが設計に無く、`getByLabel` も不可
- **観点 / レーン**: 仮置き（レーンC）／実現可能性（レーンB）／元 F-VT-M04、F-VT-M05、F-VT-B-001
- **該当箇所**: 2.1、`Label.tsx`（`<span>`、htmlFor なし）
- **問題**: 設計書項目定義にセレクタ契約が無い。`Label` は span のため `getByLabel('始業')` は一致しない。0 節は「仮置き設けない」と宣言している。
- **影響**: Phase 10 で locator が各自発明される。
- **推奨対応**: data-testid を設計書に足すか、既存 DOM の Playwright 式を観点表に凍結して仮置きと明記する。
- **仕様決定の要否**: 要

#### F-VT-009: E2E-L3 の今日日付の組み立て手順が未定義
- **観点 / レーン**: 期待結果の曖昧さ（レーンB）／元 F-VT-B-002
- **該当箇所**: E2E-L3、設計書 AC-L05 / Q6
- **問題**: `Intl` の `format()` は `MM/DD/YYYY`。`formatToParts` なのか文字列パースなのか未記載。
- **推奨対応**: `formatToParts` で year/month/day をゼロ埋めするスニペットを 2.2 に凍結（`getToday` と同じ）。
- **仕様決定の要否**: 不要（AC-L05 と同じ手順に揃える）

#### F-VT-010: E2E-L1/L7 の「既知値」が未固定
- **観点 / レーン**: 期待結果の曖昧さ（レーンB）／元 F-VT-B-003
- **該当箇所**: E2E-L1、E2E-L7
- **問題**: 始業・取引先名・実績h・良かった点の具体値が無い。
- **推奨対応**: Given に固定値を列挙する。
- **仕様決定の要否**: 不要（テストデータの固定。プロダクト仕様ではない）

#### F-VT-011: センチネル日付が親結合テストの割当と衝突する
- **観点 / レーン**: 実現可能性（レーンB）／元 F-VT-B-004
- **該当箇所**: `2000-02-01` 等、親観点表 1.0 規定 5
- **問題**: 親結合は `2000-02-01`〜`28` と 3 月前半を使用済み。本表に日付割当・後始末が無い。
- **影響**: 同一日付の残留で L2 の空フォームや AC-L11 が環境依存になる。
- **推奨対応**: 親と重ならない帯（例: `2000-04-`）へ移し、1.0 節に割当と `cleanup` を書く。
- **仕様決定の要否**: 要（設計書は `2000-02-` と書いてある。帯を変えるかは確認）

#### F-VT-012: 2.0 に投入・後始末・ハイドレーション待ちが無い
- **観点 / レーン**: 実現可能性（レーンB）／元 F-VT-B-006
- **該当箇所**: 2.0、親 E2E `effort-normalize.test.ts`
- **問題**: 成功完了待ち以外に、親が必須としている hydration 待ち、投入手段、`afterEach` 削除が無い。
- **推奨対応**: 親と同型の待ち・投入（`saveReportFn`）・日付後始末を 2.0 に書く。
- **仕様決定の要否**: 不要（親 E2E の実測必須手順の転記）

### Minor（1行のみ）

- F-VT-013: PII 行が「同上」連鎖のみ（1 章）／元 F-VT-A-M01
- F-VT-014: 0 章「1 章に載せない」と 1 章の状態遷移行が併存（0 章・1 章）／元 F-VT-A-M02
- F-VT-015: 接頭辞 `ITL-` が Given に未反映（0 章）／元 F-VT-A-M03
- F-VT-016: 良かった点も `getByLabel` 不可。構造セレクタが要る（2.1）／元 F-VT-M-001。F-VT-008 に含む
- F-VT-017: E2E-L6 が勤怠管理未記載（2.2）／F-VT-001 に含む

## レビュー観点ごとの判定

| 観点 | レーン | 判定 |
| ---- | ---- | ---- |
| 網羅性（1.5） | A | FAIL |
| 期待結果の曖昧さ | B | FAIL |
| 実現可能性 | B | FAIL |
| クリティカルパス選定 | C | FAIL |
| 仮置きの妥当性 | C | FAIL |

---

# 観点表 敵対的レビュー結果（Round 2）

- 対象: `docs/設計/日報の自動読み込み/_review/test/観点表.md`
- レビュー日時: 2026-08-16 08:33
- 方式: 差分レビュー。3レーン並列（網羅性／期待値・実現可能性／クリティカルパス選定・仮置き）
- モデル: Composer 2.5
- 総合判定: FAIL

## サマリー

| Severity | 件数 |
| -------- | ---- |
| Critical | 0    |
| Major    | 1    |
| Minor    | 2    |

Round 1 の Major 12 件はすべて解消（F-VT-012 は投入経路が部分的 → 本 Round の Major として再掲）。

## Findings

### Critical

なし

### Major

#### FIND-VT-B-R2-001: E2E の `saveReportFn` 投入経路が Playwright 既定環境で実現不能
- **観点 / レーン**: 実現可能性（レーンB）
- **該当箇所**: 観点表 1.0 規定 6、2.0 規定 6、E2E-L1/L7 Given（Round 2 時点）
- **問題**: L1/L7 が `saveReport` ヘルパーまたは `saveReportFn` HTTP POST を要求するが、(1) `report-db-helpers` は DB 名 `workhub` で import 時 throw、(2) HTTP POST に JSON 本文を付けると seroval が 500 を返す（親 E2E-6 実測）、(3) 既存 E2E の投入実例は UI 保存のみ。
- **影響**: Phase 10 で L1/L7 が書けないか、実装者ごとに投入コードが分岐する。
- **推奨対応**: E2E 投入を親と同型の別 BrowserContext UI 保存に 1 系統凍結。`report-db-helpers` import と HTTP POST を禁止。
- **仕様決定の要否**: 不要（テスト手順の凍結。プロダクト仕様ではない）

### Minor（1行のみ）

- F-VT-R2-M01: 実装計画 5.3.4 タスク行が AC-L30 を列挙していない（`実装計画.md` 126 行）。観点表は 5.3.4 へ委譲済み
- FIND-VT-B-R2-M01: 1.0 の PJ/タスク名が `DailyReportData` のどのフィールドか未マッピング（観点表 1.0）

## レビュー観点ごとの判定

| 観点 | レーン | 判定 |
| ---- | ---- | ---- |
| 網羅性（1.5） | A | PASS |
| 期待結果の曖昧さ | B | PASS |
| 実現可能性 | B | FAIL |
| クリティカルパス選定 | C | PASS |
| 仮置きの妥当性 | C | PASS |

---

# 観点表 敵対的レビュー結果（Round 3）

- 対象: `docs/設計/日報の自動読み込み/_review/test/観点表.md`
- レビュー日時: 2026-08-16 08:40
- 方式: 差分レビュー。3レーン並列
- モデル: Composer 2.5
- 総合判定: FAIL

## サマリー

| Severity | 件数 |
| -------- | ---- |
| Critical | 0    |
| Major    | 2    |
| Minor    | 2    |

FIND-VT-B-R2-001 は解消。新規は後始末範囲とウォームアップ手順。

## Findings

### Critical

なし

### Major

#### FIND-VT-B-R3-001: 後始末がファイル全日付一括だと `fullyParallel` で投入を消す
- **観点 / レーン**: 実現可能性（レーンB）
- **該当箇所**: 2.0 規定 8（Round 3 時点）
- **問題**: 「当該ファイルが使う 1.0 の日付」削除だと、並列中の他シナリオの `2000-04-10` 等を消す。
- **推奨対応**: 親と同型にシナリオ単位の日付だけ `afterEach`。ファイル一括削除を禁止。
- **仕様決定の要否**: 不要

#### FIND-VT-B-R3-002: ウォームアップに `2000-04-09` への日付入力が無い
- **観点 / レーン**: 実現可能性（レーンB）
- **該当箇所**: 2.0 規定 5
- **問題**: 対象日付を書くだけで手順が無く、規定 6 の日付変更＋読み込み待ちがシナリオ本体の初回になる。
- **推奨対応**: `goto` → hydration → 日付を `2000-04-09` → 成功完了待ち（保存しない）。
- **仕様決定の要否**: 不要

### Minor（1行のみ）

- FIND-VT-B-R3-M01: 投入を各 test の Given 先頭に固定していなかった（2.0 規定 6）
- FIND-VT-B-R3-M02: 日付変更前に編集しないことが暗黙だった（2.0 規定 6）

## レビュー観点ごとの判定

| 観点 | レーン | 判定 |
| ---- | ---- | ---- |
| 網羅性（1.5） | A | PASS |
| 期待結果の曖昧さ | B | PASS |
| 実現可能性 | B | FAIL |
| クリティカルパス選定 | C | PASS |
| 仮置きの妥当性 | C | PASS |

---

## Round 4（差分・2026-08-16）

- 方式: 3レーン並列（Composer 2.5）。対象は Round 3 反映後の観点表（2.0 規定 5・8、2.3、1.0 日付割当）
- 総合: **PASS**（Critical 0・Major 0・Minor 0）
- FIND-VT-B-R3-001 / R3-002 / R3-M01 / R3-M02 は解消確認
- 仮置きなし。Phase 7 スキップのため **収束による確定で凍結**

### Critical

なし

### Major

なし

### Minor（1行のみ）

なし

## レビュー観点ごとの判定（Round 4）

| 観点 | レーン | 判定 |
| ---- | ---- | ---- |
| 網羅性（1.5） | A | PASS |
| 期待結果の曖昧さ | B | PASS |
| 実現可能性 | B | PASS |
| クリティカルパス選定 | C | PASS |
| 仮置きの妥当性 | C | PASS |

---

# テスト 敵対的レビュー結果（Phase 6 Round 1）

- **対象**: `apps/web/src/lib/report-load.test.ts` / `report-load-flow.test.ts` / `defaults.test.ts` / `time-utils.test.ts`（追記） / `storage.test.ts` / `routes/index.report-load.test.ts` / `server/functions/reports.test.ts`（追記） / `reports-get-by-date.integration.test.ts`。スタブ: `report-load.ts` / `storage.ts#getByDate` / `defaults.ts` / `time-utils.ts#getToday` / `reports.ts#getReportByDateFn`
- **レビュー日時**: 2026-08-16
- **方式**: 敵対的較正・3レーン並列（A: 欺瞞性 / B: 仕様対応 / C: セキュリティと証拠）。Adversary は fresh context・Read 専用。findings は司令塔が disk に保存
- **Phase 7（人間レビュー）**: スキップ
- **総合判定**: FAIL

## サマリー

| Severity | 件数 |
|---|---|
| Critical | 2 |
| Major    | 14 |
| Minor    | 13 |

### Critical / Major findings 見出し一覧

- **FIND-P6-B-001**: クリティカルパス AC-L33 が Phase 5 テストに存在しない
- **FIND-P6-B-002**: クリティカルパス AC-L34 の日付切替シナリオが結合内部に無い
- **FIND-P6-A-001**: AC-L04 が Green 後に自己参照トートロジーになる
- **FIND-P6-A-002**: エイリアス同値比較テストが Green 後に恒常 PASS し、欠陥検出力がない
- **FIND-P6-A-003**: 設計書に無い `startLoad` 分割 API をテストが必須化している
- **FIND-P6-A-004**: `FORM_CONTROLS` 識別子集合の列挙が AC-L30 を内部実装に固定している
- **FIND-P6-A-005**: 設計書「少なくとも export」一覧に無いヘルパー群をテストが固定している
- **FIND-P6-B-003**: AC-L41「再試行」がテスト未コード
- **FIND-P6-B-004**: AC-L42 の error 中 disabled 検証が不完全
- **FIND-P6-B-005**: AC-L46 の error 中操作可能範囲・日付変更が未検証
- **FIND-P6-B-006**: AC-L55（保存成功後 dirty 解除）のテスト無し
- **FIND-P6-B-007**: AC-L51 / AC-L56 の `ready`+dirty ヘッダー遷移 confirm が結合内部で未検証
- **FIND-P6-B-008**: AC-L50 の confirm OK 経路が未検証
- **FIND-P6-B-009**: AC-L35 の空日付保存（`dateMissing`）が未検証
- **FIND-P6-C-001**: スタブ `report-load.ts` に Phase 8 相当の実ロジックが混入
- **FIND-P6-C-002**: Red Phase 証拠が「スタブ最小実装」を過剰断言

## 設計書 受け入れ条件 × テスト 対応マトリクス

凡例：✅ 対応テストあり / ⚠️ 部分的・不十分 / ❌ 未対応 / N/A 本テストの責務外

| 設計書 受け入れ条件 | 該当行 | 対応テスト | 状況 |
|---|---|---|---|
| AC-L01 | 設計書 L85 | `time-utils.test.ts` L70-71 | ✅ |
| AC-L02 | L86 | `time-utils.test.ts` L74-77 | ✅ |
| AC-L03 | L87 | `time-utils.test.ts` L80-83 | ✅ |
| AC-L04 | L88 | `defaults.test.ts` L24-33 | ✅（Green 後トートロジー化は FIND-P6-A-001） |
| AC-L05 | L89 | `time-utils.test.ts` L87-100 | ✅ |
| AC-L10 | L95 | `reports-get-by-date.integration.test.ts` L59-90 | ⚠️（観点表 1.1 の日付・`ITL-ACL10-`・cleanup は一致。`rowToReport` との同値比較は未実施） |
| AC-L11 | L96 | `reports-get-by-date.integration.test.ts` L93-100 | ✅ |
| AC-L12 | L97 | `reports.test.ts` L217-223；`report-load-flow.test.ts` L101-108 | ⚠️（サーバ経路は `null` のみ。DB 非接触の呼び出し回数断言なし） |
| AC-L13 | L98 | `reports.test.ts` L162-168 | ✅ |
| AC-L14 | L99 | `storage.test.ts` L23-38 | ✅ |
| AC-L15 | L100 | `report-load.test.ts` L56-67 | ✅ |
| AC-L20 | L108 | `report-load.test.ts` L71-83, L143-156 | ✅ |
| AC-L21 | L109 | `report-load.test.ts` L86-99, L124-127 | ✅ |
| AC-L22 | L110 | `report-load.test.ts` L101-122 | ✅ |
| AC-L23 | L111 | `report-load.test.ts` L130-133 | ✅ |
| AC-L24 | L112 | `report-load.test.ts` L135-141 | ⚠️（`isReportDirty(saved,saved)` のみ。保存成功後の `baseline` 更新経路は未検証） |
| AC-L30 | L118 | `report-load-flow.test.ts` L66-77 | ⚠️（計画 5.3.4 どおり純粋集合。DOM は Phase 10） |
| AC-L31 | L119 | `report-load-flow.test.ts` L262-276 | ⚠️（`runStartLoad` 代用。画面観測は E2E-L7＝Phase 10） |
| AC-L32 | L120 | — | N/A（E2E-L8＝Phase 10） |
| AC-L33 | L121 | — | ❌ |
| AC-L34 | L122 | `report-load-flow.test.ts` L170-179 | ❌（日付切替オーケストレーション無し） |
| AC-L35 | L123 | `report-load-flow.test.ts` L101-108；`report-load.test.ts` L212-216 | ⚠️（空日付 `''` の startLoad 無し。`dateMissing` 未検証） |
| AC-L36 | L124 | `report-load.test.ts` L269-271 | ⚠️（文言 ✅。testid の DOM/ソース断言なし） |
| AC-L37 | L125 | `report-load-flow.test.ts` L74-77 | ⚠️（ready で disabled 空のみ。バナー非表示は Phase 10） |
| AC-L40 | L131 | `report-load-flow.test.ts` L153-168, L194-205 | ⚠️（失敗遷移・内容維持はある。バナー testid は定数のみ） |
| AC-L41 | L132 | — | ❌ |
| AC-L42 | L133 | `report-load-flow.test.ts` L80-86 | ❌ |
| AC-L43 | L134 | `report-load-flow.test.ts` L138-151 | ✅ |
| AC-L44 | L135 | `report-load.test.ts` L166-201 | ✅ |
| AC-L45 | L136 | `report-load.test.ts` L219-233；`report-load-flow.test.ts` L194-205 | ✅ |
| AC-L46 | L137 | `report-load-flow.test.ts` L80-86 | ❌ |
| AC-L50 | L143 | `report-load-flow.test.ts` L208-219；`report-load.test.ts` L237-240 | ⚠️（キャンセルのみ。OK 経路未検証。dialog は E2E-L5＝Phase 10） |
| AC-L51 | L144 | `report-load-flow.test.ts` L233-244；`report-load.test.ts` L243-246 | ⚠️（`ready`+dirty のヘッダー遷移未検証。dialog は E2E-L6＝Phase 10） |
| AC-L52 | L145 | `report-load-flow.test.ts` L221-230, L234-236 | ✅ |
| AC-L53 | L146 | `report-load-flow.test.ts` L246-248 | ✅ |
| AC-L54 | L147 | `report-load.test.ts` L250-266 | ✅ |
| AC-L55 | L148 | — | ❌ |
| AC-L56 | L149 | `report-load-flow.test.ts` L238-244 | ⚠️（`ready`+dirty の SPA confirm 未検証） |
| AC-L60 | L156 | `index.report-load.test.ts` L17-32 | ✅ |
| AC-L61 | L157 | — | N/A（E2E-L4・親 E2E＝Phase 10） |
| AC-L62 | L158 | `index.report-load.test.ts` L35-42；既存 `saved-msg.test.ts` | ✅ |
| AC-L63 | L150 | — | N/A（親 E2E＝Phase 10） |

未定義番号（AC-L06〜L09 / L16〜L19 / L25〜L29 / L38〜L39 / L47〜L49 / L57〜L59）は設計書に AC が無いため N/A。

## Findings（Critical / Major）

### FIND-P6-B-001: クリティカルパス AC-L33 が Phase 5 テストに存在しない
- **観点 / レーン**: 受け入れ条件との対応（レーンB）
- **重大度**: Critical
- **ファイル**: 設計書 L121（AC-L33）；実装計画 5.3.4；`apps/web/src/lib/report-load-flow.test.ts` 全体
- **問題**: 日付を保存済み日 `D` に切り替え、完了後 `isReportDirty(画面, applyLoadSuccess(D, 取得結果)) === false` となるクリティカルパスが、結合内部テストに無い。`finalizeStartLoad` の汎用成功・`handleDateChange` のキャンセルのみで、日付切替成功シナリオは未コード化。
- **影響**: Phase 7 スキップのため、Phase 8 で日付切替後に dirty が残る・baseline 不整合・`raw_data.date` 上書き漏れが単体/結合内部では検出されない。E2E-L1 は観点表凍結済みだが Playwright 未作成（Phase 10）。
- **推奨対応**: 非 dirty の日付変更 → 読み込み成功（保存済み mock）後に `isReportDirty === false`・`data.date === D` を検証するケースを追加する。
- **戻り先**: Phase 5

### FIND-P6-B-002: クリティカルパス AC-L34 の日付切替シナリオが結合内部に無い
- **観点 / レーン**: 受け入れ条件との対応（レーンB）
- **重大度**: Critical
- **ファイル**: 設計書 L122（AC-L34）；`apps/web/src/lib/report-load-flow.test.ts`（null 成功は `finalizeStartLoad` 直叩きのみ）
- **問題**: 行なし日付への切替後「空初期値・日付欄 `D`」を、日付変更オーケストレーション経路で検証していない。
- **影響**: L33 と同様、Phase 8 前にクリティカルパス回帰を機械的に止められない。
- **推奨対応**: 日付変更 → null 応答で空初期値・`data.date === D`・`loadStatus === 'ready'` を検証する。
- **戻り先**: Phase 5

### FIND-P6-A-001: AC-L04 が Green 後に自己参照トートロジーになる
- **観点 / レーン**: トートロジー検出（MC-1）（レーンA）
- **重大度**: Major
- **ファイル**: `apps/web/src/lib/defaults.test.ts:24-26`
- **問題**: `getToday` を `vi.fn(() => '2026-08-17')` でモックしたうえで `expect(defaultDailyReport().date).toBe(getToday())` としている。Phase 8 で `defaultDailyReport` が `date ?? getToday()` になると、期待値・実装値の両方が同一モック `getToday()` を呼ぶだけになり、実装が壊れても検出できない。
- **影響**: Green 後は欠陥をすり抜け、日付初期値の誤実装が Phase 10 まで残る。
- **推奨対応**: モック固定値を右辺に直書きする（`expect(defaultDailyReport().date).toBe('2026-08-17')`）。右辺で `getToday()` を呼ばない。併せて引数指定時はモックに依存しないケースを追加する。
- **戻り先**: Phase 5

### FIND-P6-A-002: エイリアス同値比較テストが Green 後に恒常 PASS し、欠陥検出力がない
- **観点 / レーン**: トートロジー検出（MC-1）（レーンA）
- **重大度**: Major
- **ファイル**: `apps/web/src/lib/report-load.test.ts:205-233`
- **問題**: `shouldFetchReport(date)` を `isValidReportDate(date)` と、`isLoadableReport(value)` を `isValidReportStructure(value)` とそれぞれ `toBe` で比較している。正しいエイリアス実装なら常に PASS する。Red ではスタブ throw で FAIL するが、Green 後は欠陥検出力が実質ゼロ。
- **影響**: AC-L12 / L35 / L45 の単体担当テストとしては、定数一致テストと同等の浅さ。
- **推奨対応**: 同値比較を削除し、入出力ベースの代表ケースのみ残す（不正日付で false・正常構造で true・null で false 等、固定値 assert）。
- **戻り先**: Phase 5

### FIND-P6-A-003: 設計書に無い `startLoad` 分割 API をテストが必須化している
- **観点 / レーン**: 実装詳細の過剰束縛（レーンA）
- **重大度**: Major
- **ファイル**: `apps/web/src/lib/report-load-flow.test.ts`；スタブ `apps/web/src/lib/report-load.ts`（`beginStartLoad` / `finalizeStartLoad` / `runStartLoad`）
- **問題**: 設計書は読み込み手順を `startLoad(date)` の 8 ステップで記述するのみ。`beginStartLoad` / `finalizeStartLoad` / `runStartLoad` という関数名・責務分割は設計書に無い。テストは戻りの `effects` 形状まで固定している。
- **影響**: Phase 8 で単一の `startLoad` にまとめる正当なリファクタがテストにより禁止される。
- **推奨対応**: 公開 API を設計書の `startLoad`（state + deps）に寄せ、日付先行更新・stale 無視・401・null 成功・構造不正を入出力で検証する。
- **戻り先**: Phase 5

### FIND-P6-A-004: `FORM_CONTROLS` 識別子集合の列挙が AC-L30 を内部実装に固定している
- **観点 / レーン**: 実装詳細の過剰束縛（レーンA）
- **重大度**: Major
- **ファイル**: `apps/web/src/lib/report-load-flow.test.ts`；`apps/web/src/lib/report-load.ts` の `FORM_CONTROLS`
- **問題**: AC-L30 はユーザーが操作できない UI 要素を列挙するが、`'tabReport'` 等の内部識別子や `FORM_CONTROLS` 定数は設計書に無い。テストは全要素の disabled を要求し、配列の追加・改名で FAIL する。
- **影響**: DOM の disabled 付与方法を変えても AC-L30 を満たす実装が、テストにより拒否される。
- **推奨対応**: AC-L30 / L42 / L46 の操作可否を振る舞い（loading 中は日付欄含むフォーム操作不可、error 中は日付と再試行のみ可、ready は操作可）で断言する。内部識別子の完全列挙はテストに書かない。
- **戻り先**: Phase 5

### FIND-P6-A-005: 設計書「少なくとも export」一覧に無いヘルパー群をテストが固定している
- **観点 / レーン**: 実装詳細の過剰束縛（レーンA）
- **重大度**: Major
- **ファイル**: `apps/web/src/lib/report-load-flow.test.ts`；`apps/web/src/lib/report-load.ts`（`getDisabledControls` / `handleDateChange` / `shouldConfirm*` 等）
- **問題**: 設計書「純粋関数の配置」の export 一覧にこれらのヘルパーは含まれない。テストは関数シグネチャと戻り値を直接 assert している。
- **影響**: `index.tsx` が設計書どおりインライン分岐で AC を満たしても、ヘルパー未 export ならテストが FAIL する。
- **推奨対応**: テストを `startLoad` / 日付変更の入出力シナリオに集約する。confirm 系は設計書にある `shouldPreventUnload` と定数、および日付変更・離脱の入出力で検証する。設計書へ API 追記はしない（承認済み成果物の変更は人間判断のため）。
- **戻り先**: Phase 5

### FIND-P6-B-003: AC-L41「再試行」がテスト未コード
- **観点 / レーン**: 受け入れ条件との対応（レーンB）
- **重大度**: Major
- **ファイル**: 設計書 L132；実装計画 5.3.4；`report-load-flow.test.ts`（該当 describe 無し）
- **問題**: 失敗バナー上の再試行が `startLoad(data.date)` を再度呼ぶ契約に対し、retry ハンドラ・`error`→`loading`→成功のシーケンステストが無い。
- **影響**: 再試行が古い日付で呼ばれる欠陥を Phase 8 で見逃す。
- **推奨対応**: `error` 状態から再試行が `data.date` で読み込みを再開し、成功時に L33/L34 同等になるケースを追加する。
- **戻り先**: Phase 5

### FIND-P6-B-004: AC-L42 の error 中 disabled 検証が不完全
- **観点 / レーン**: 受け入れ条件との対応／エッジケース（レーンB）
- **重大度**: Major
- **ファイル**: 設計書 L133；`report-load-flow.test.ts`（`getErrorEnabledControls` が date / saveReport / projectInput のみ）
- **問題**: AC-L42 が要求する所感・タブ 3 種・出力リンク・取引先追加の disabled が未断言。
- **影響**: error 中にタブ切替・上書き保存が可能になる実装バグをテストが通す。
- **推奨対応**: FIND-P6-A-004 と両立する形で、error 時は日付と再試行以外が操作不可であることを振る舞い断言する（内部識別子の完全列挙はしない）。
- **戻り先**: Phase 5

### FIND-P6-B-005: AC-L46 の error 中操作可能範囲・日付変更が未検証
- **観点 / レーン**: 受け入れ条件との対応／エッジケース（レーンB）
- **重大度**: Major
- **ファイル**: 設計書 L137；`report-load-flow.test.ts`（handleDateChange は ready 前提）
- **問題**: 「再試行」操作可能のテスト無し。`loadStatus === 'error'` 時の日付変更（dirty confirm 含む）が未テスト。
- **影響**: error 恒常失敗から日付で逃げられない・retry が disabled のまま等の欠陥を検出できない。
- **推奨対応**: error 状態で日付変更→読み込み再開、再試行が `data.date` を読むケースを追加する。
- **戻り先**: Phase 5

### FIND-P6-B-006: AC-L55（保存成功後 dirty 解除）のテスト無し
- **観点 / レーン**: 受け入れ条件との対応（レーンB）
- **重大度**: Major
- **ファイル**: 設計書 L148；実装計画 5.3.4（L50〜L56）
- **問題**: 保存成功で `baseline = data`・その後 confirm 不出、という状態遷移がどのテストにも無い。AC-L24 は `isReportDirty` 同値のみで保存ハンドラを経ていない。
- **影響**: 保存後も dirty 残存→不要 confirm、または baseline 未更新→誤 dirty の実装が Green 化する。
- **推奨対応**: 保存成功後に baseline を保存内容へ揃え、日付変更・離脱の confirm が出ないことを入出力で検証する（`saved-msg.test.ts` は触らない）。
- **戻り先**: Phase 5

### FIND-P6-B-007: AC-L51 / AC-L56 の `ready`+dirty ヘッダー遷移 confirm が結合内部で未検証
- **観点 / レーン**: 受け入れ条件との対応（レーンB）
- **重大度**: Major
- **ファイル**: 設計書 L144, L149；`report-load-flow.test.ts`
- **問題**: `shouldConfirmLeavePage(true, 'error')` はあるが、`shouldConfirmLeavePage(true, 'ready')` が無い。設計書・Q13 では `ready` かつ dirty でも AC-L51 を適用。
- **影響**: `ready`+dirty でヘッダー遷移 confirm が出ない実装がテストを通す（E2E-L6 は Phase 10 未コード）。
- **推奨対応**: ready かつ dirty なら離脱 confirm する／loading ならしない、を `shouldPreventUnload` と対になる入出力（または日付変更と同じ confirm 注入）で検証する。
- **戻り先**: Phase 5

### FIND-P6-B-008: AC-L50 の confirm OK 経路が未検証
- **観点 / レーン**: 受け入れ条件との対応／エッジケース（レーンB）
- **重大度**: Major
- **ファイル**: `apps/web/src/lib/report-load-flow.test.ts`（confirm → false のみ）
- **問題**: dirty かつ `confirm`→true のとき `startLoad` に進む設計書 step がテストされていない。
- **影響**: OK 後に状態が変わらない・API 未呼び出し等の欠陥を見逃す。
- **推奨対応**: confirm true なら変更先日付で読み込みを開始することを検証する。
- **戻り先**: Phase 5

### FIND-P6-B-009: AC-L35 の空日付保存（`dateMissing`）が未検証
- **観点 / レーン**: エッジケース・例外系（レーンB）
- **重大度**: Major
- **ファイル**: 設計書 L123；`report-load-flow.test.ts`（`2026-02-30` のみ。`''` 無し）
- **問題**: 不正日付で API 非呼び出し・日付欄 `''` は部分的にあるが、空日付で保存→`savedMsg` の `dateMissing`（現行回帰）への結び付けテストが無い。
- **影響**: 空フォーム上書き保存やメッセージ回帰を本機能変更で壊しても検出不能。
- **推奨対応**: invalid/`''` 到達後も保存時に `dateMissing` を送る契約を、`index.tsx` のソース断言（既存 `dateMissing` 文字列）または `savedMsgReducer` を触らない形の結合内部で追加する。`saved-msg.test.ts` は変更しない。
- **戻り先**: Phase 5

### FIND-P6-C-001: スタブ `report-load.ts` に Phase 8 相当の実ロジックが混入
- **観点 / レーン**: Red Phase log の妥当性（MC-5）（レーンC）
- **重大度**: Major
- **ファイル**: `apps/web/src/lib/report-load.ts`（`emptyReport` / `applyLoadSuccess`）
- **問題**: `emptyReport` は `defaultDailyReport()` を呼び出して合成し、`applyLoadSuccess` は `report === null` 分岐で `emptyReport(date)` を返す。スタブ最小実装（シグネチャ＋固定ダミー返却のみ・実ロジック禁止）に反する。
- **影響**: `__STUB_*` 除去だけで一部テストが早期 Green になり、本番ロジックのレビュー密度が下がる。
- **推奨対応**: Red Phase 中は `emptyReport` / `applyLoadSuccess` を throw または AC と一致しない固定センチネルのみにする。`defaultDailyReport()` 呼び出しと null 分岐を除去する。
- **戻り先**: Phase 5

### FIND-P6-C-002: Red Phase 証拠が「スタブ最小実装」を過剰断言
- **観点 / レーン**: Red Phase log の妥当性（MC-5）（レーンC）
- **重大度**: Major
- **ファイル**: `docs/設計/日報の自動読み込み/_review/test/red-phase-evidence.md`；対照 `apps/web/src/lib/report-load.ts`
- **問題**: 証拠は変更内容を「スタブ最小実装」と記録しているが、FIND-P6-C-001 のとおり分岐・合成ロジックが存在する。件数は一致するが、実装物の性質に関する記述が実態と食い違う。
- **影響**: MC-5 の証拠妥当性要件を満たさない。
- **推奨対応**: C-001 修正後に司令塔が `npm run test` を再実行し、証拠を実態に合わせて更新する。
- **戻り先**: Phase 5（証拠は司令塔が更新）

## Minor（1行のみ）

- FIND-P6-A-006: `expectEmptyReport` が `defaultDailyReport(date)` ではなくリテラル固定値を assert し二重管理（`report-load.test.ts` / `report-load-flow.test.ts`）
- FIND-P6-A-007: 401 テストが `LOGIN_ON_401_HREF` 定数を使わず文字列直書き（`report-load-flow.test.ts`）
- FIND-P6-A-008: `LEAVE_PAGE_CONFIRM` 定数テストが `report-load.test.ts` と `report-load-flow.test.ts` で重複
- FIND-P6-A-009: `handleDateChange` の dirty+cancel で `action === 'none'` がスタブ既定と一致し、confirm 断言が通った後の単独検出力が弱い
- FIND-P6-A-010: `getErrorEnabledControls` が AC-L46 の「再試行」操作可能を検証していない
- FIND-P6-B-M01: AC-L10 が `rowToReport` 関数と同値比較せずハードコード期待のみ（`reports-get-by-date.integration.test.ts`）
- FIND-P6-B-M02: AC-L12 サーバ経路で DB モック呼び出し回数 0 の断言なし（`reports.test.ts`）
- FIND-P6-B-M03: `beginStartLoad` の空文字 `''` 日付ケース未追加
- FIND-P6-B-M04: `tasks` 配列長差の dirty 未テスト（`report-load.test.ts` は `projects` 長のみ）
- FIND-P6-B-M05: `reports-get-by-date.integration.test.ts` で `makeSingleBlockReport` import 未使用
- FIND-P6-C-003: `reports.test.ts` の describe が親機能ラベル「6-2 requireSession」で AC-L13 トレーサビリティが弱い

## レビュー観点ごとの判定

| 観点 | レーン | 判定 | 裏付け |
|---|---|---|---|
| トートロジー検出 | A | FAIL | FIND-P6-A-001 / A-002 |
| 実装詳細の過剰束縛 | A | FAIL | FIND-P6-A-003 / A-004 / A-005 |
| 受け入れ条件との対応 | B | FAIL | マトリクス ❌ 7（L33/L34/L41/L42/L46/L55） |
| エッジケース・例外系の網羅 | B | FAIL | FIND-P6-B-004 / B-005 / B-008 / B-009 |
| 未決事項の温存（MC-4） | B | PASS | TBD・仮置き期待値なし |
| セキュリティ・品質観点 | C | PASS | AC-L13 / L44。PII・認可 2 層は設計非該当で N/A 整合 |
| Red Phase log の妥当性 | C | FAIL | FIND-P6-C-001 / C-002。件数 83/232/315 は一致 |

## 仕様決定要否

不要。承認済み設計書の変更は行わない。A-003/A-005 はテストを設計書の `startLoad` / 公開関数一覧に寄せて解消する。

---

# テスト 敵対的レビュー結果（Phase 6 Round 2）

- **対象**: Round 1 修正差分（`report-load.ts` / `report-load-flow.test.ts` / `report-load.test.ts` / `defaults.test.ts` / `index.report-load.test.ts` / `reports.test.ts` / `red-phase-evidence.md`）
- **レビュー日時**: 2026-08-16
- **方式**: 差分・3レーン並列。must-catch 毎周実施
- **Phase 7**: スキップ
- **総合判定**: FAIL

## サマリー

| Severity | 件数 |
|---|---|
| Critical | 0 |
| Major    | 4 |
| Minor    | 6 |

### Critical / Major findings 見出し一覧

- **FIND-P6-A-R2-001**: AC-L55 が保存ハンドラを経ず自己構成のトートロジー
- **FIND-P6-A-R2-002**: `startLoad` 完了後に `loading` を期待し設計と矛盾
- **FIND-P6-A-R2-003**: 設計書 export 外の `getFormControlsAccessibility` を戻り値固定
- **FIND-P6-B-R2-001**: AC-L51 / AC-L56 の SPA confirm を `shouldPreventUnload` と混同

## 前回解消確認

| FIND-ID | 解消 |
|---|---|
| FIND-P6-B-001 / B-002 | 解消（Critical 0） |
| FIND-P6-A-001 / A-002 / A-003 / A-004 | 解消 |
| FIND-P6-A-005 | 部分的（R2-003 に残存） |
| FIND-P6-B-003 / B-004 / B-005 / B-006 / B-008 / B-009 | 解消 |
| FIND-P6-B-007 | 未解消（R2-001） |
| FIND-P6-C-001 / C-002 | 解消 |

マトリクス: 前回 ❌ 7 件はすべて昇格。❌ 残存なし。⚠️ は L35/L51/L56。

## Findings（Critical / Major）

### FIND-P6-A-R2-001: AC-L55 が保存ハンドラを経ず自己構成のトートロジー
- **観点 / レーン**: トートロジー検出（MC-1）（レーンA）
- **重大度**: Major
- **ファイル**: `apps/web/src/lib/report-load-flow.test.ts:383-402`
- **問題**: `afterSave` を `data: saved, baseline: saved` と手動構築したうえで dirty false を断言している。保存成功で `baseline = data` する経路を呼ばない。`shouldPreventUnload(false, 'ready')` はリテラル `false` を渡している。
- **影響**: 保存後 baseline 未更新が Green 化する（FIND-P6-B-006 と同根）。
- **推奨対応**: 保存成功の入出力関数（例: `markReportSaved(state)`）の**出力**に対して dirty / confirm 不出を検証する。スタブは throw。
- **戻り先**: Phase 5

### FIND-P6-A-R2-002: `startLoad` 完了後に `loading` を期待し設計と矛盾
- **観点 / レーン**: 実装詳細の過剰束縛（レーンA）
- **重大度**: Major
- **ファイル**: `apps/web/src/lib/report-load-flow.test.ts:112-122`；設計書 startLoad step 4〜8
- **問題**: `await startLoad(...)` で関数全体の完了を待っているのに `loadStatus === 'loading'` を期待する。正しい実装では完了後は `'ready'`。
- **影響**: Phase 8 で正しい `startLoad` がこのテストで FAIL する。
- **推奨対応**: `getByDate` を未解決 Promise にし、await 前の同期フェーズを `StartLoadDeps` の注入（例: `onBeforeFetch(state)`）で観測する。完走ケースの期待は `'ready'`。
- **戻り先**: Phase 5

### FIND-P6-A-R2-003: 設計書 export 外の `getFormControlsAccessibility` を戻り値固定
- **観点 / レーン**: 実装詳細の過剰束縛（レーンA）
- **重大度**: Major
- **ファイル**: `apps/web/src/lib/report-load.ts`；`report-load-flow.test.ts:81-105`
- **問題**: 設計書「純粋関数の配置」一覧に無いヘルパーの 3 値を `toEqual` で固定している。
- **影響**: DOM で AC-L30 を満たす実装がヘルパー未 export なら FAIL する。
- **推奨対応（司令塔）**: 設計書は「**少なくとも**次を export」であり追加は禁止されていない。実装計画 5.3.4 が「画面用ヘルパー」で AC-L30 を内部検証すると明記。本ヘルパーを削除すると B-004 が再発する。**ヘルパーは残す。** 5.3.4 に関数名を明記する。テストは 3 状態の振る舞い（date/retry/formLocked）を維持する。
- **戻り先**: Phase 5（実装計画の明記＋ヘルパー維持。テスト削除はしない）

### FIND-P6-B-R2-001: AC-L51 / AC-L56 の SPA confirm を `shouldPreventUnload` と混同
- **観点 / レーン**: 受け入れ条件との対応（レーンB）
- **重大度**: Major
- **ファイル**: 設計書 L400；`report-load.test.ts`；`report-load-flow.test.ts`
- **問題**: SPA confirm は `dirty && (ready || error)`。`shouldPreventUnload` は `(ready && dirty) || error` で error 非 dirty でも true。別契約なのに AC-L51 ラベルで `shouldPreventUnload` を使っている。
- **影響**: error 非 dirty で SPA confirm が出る／ready+dirty で出ない実装を検出できない。
- **推奨対応**: `shouldConfirmSpaLeave(dirty, loadStatus)` を追加し `it.each` で検証。`shouldPreventUnload` のラベルは AC-L54 のみ。
- **戻り先**: Phase 5

## Minor（1行のみ）

- FIND-P6-A-R2-M01: `getFormControlsAccessibility('error')` 断言の重複
- FIND-P6-A-R2-M02: `expectEmptyReport` リテラル二重管理（A-006 継続）
- FIND-P6-A-R2-M03: AC-L55 で `shouldPreventUnload` にリテラル false
- FIND-P6-B-R2-M01: `dateMissing` は文字列存在のみ
- FIND-P6-B-R2-M02: AC-L55 手組み afterSave（A-R2-001 と同根）
- FIND-P6-C-R2-M01: `onDateChange` の `action:'none'` 固定は confirm 断言を外すとトートロジー余地

## レビュー観点ごとの判定

| 観点 | レーン | 判定 | 裏付け |
|---|---|---|---|
| トートロジー検出 | A | FAIL | FIND-P6-A-R2-001 |
| 実装詳細の過剰束縛 | A | FAIL | FIND-P6-A-R2-002 / R2-003 |
| 受け入れ条件との対応 | B | FAIL | FIND-P6-B-R2-001。❌ はゼロ |
| エッジケース・例外系の網羅 | B | FAIL | L51/L56 SPA |
| 未決事項の温存 | B | PASS | TBD なし |
| セキュリティ・品質観点 | C | PASS | MC-2/3 N/A 整合 |
| Red Phase log の妥当性 | C | PASS | 89/234/323。スタブ throw |

## 仕様決定要否

不要。設計書は変更しない。


