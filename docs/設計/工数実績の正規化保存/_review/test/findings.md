# テスト 敵対的レビュー結果（Phase 6 Round 1）

- **対象**：
  - `apps/web/src/server/report-normalize.test.ts`（94）／`apps/web/src/lib/saved-msg.test.ts`（24）／`apps/web/src/server/functions/reports.test.ts`（19）
  - `apps/web/src/server/functions/reports-{irreversible,constraints,join,transaction,common}.integration.test.ts`（13/15/9/9/24）
  - スタブ：`apps/web/src/server/report-normalize.ts`／`apps/web/src/lib/saved-msg.ts`
  - ヘルパー：`apps/web/src/test/report-builders.ts`／`apps/web/src/test/report-db-helpers.ts`
- **レビュー日時**：2026-08-15
- **方式**：敵対的較正・3レーン並列（A: 欺瞞性 / B: 仕様対応 / C: セキュリティと証拠）。Adversary は fresh context・Read 専用。findings は司令塔が disk に保存
- **Phase 7（人間レビュー）**：実施
- **総合判定**：**FAIL**（Critical 0・Major 6）
- **⚠️ レーンC は API のセッション上限により途中終了した。**セキュリティ観点（⑤）と Red Phase 証拠の妥当性（⑥）は**未レビュー**である。MC-2・MC-3・MC-5・MC-9 が未消化のまま残っている

## サマリー

| Severity | 件数 |
|---|---|
| Critical | 0 |
| Major | 6（レーンA 4・レーンB 2） |
| Minor | 16（レーンA 7・レーンB 7・重複調整前） |

### Critical / Major findings 見出し一覧

- **FIND-001**（A）：自動消去時間の期待値を SUT 自身から import しており、AC-80 の「2000ms」が一切束縛されていない
- **FIND-002**（A）：AC-87「`ms` をそのまま渡す」のテストが、入力と期待値に同一定数を使うためハードコード実装を落とせない
- **FIND-003**（A）：AC-87「コールバックが dispatch する」テストが、コールバック外で先行 dispatch する実装を落とせない（`saved-msg.test.ts` 24 件すべてを通過する違反実装が構成できる）
- **FIND-004**（A）：1-6③ が Given（`daily_reports` 行の存在・`time_entries` 0 件）を主張しておらず、対象欠陥を検証しないまま PASS する経路が残る
- **FIND-B01**（B）：5-10 ④「`data` 自体が `null`」が `deleteReportFn` に対して実施されていない（AC-73 の 4 入力のうち 1 つが未検証）
- **FIND-B02**（B）：5-10 の期待結果「拒否される入力は…**DB に触れない**」がテストに落ちていない（AC-73・AC-74 の後段が未検証）

## 設計書 受け入れ条件 × テスト 対応マトリクス（レーンB）

**集計：✅ 74 ／ ⚠️ 2 ／ ❌ 0 ／ N/A 8**

- **N/A 8 件**：AC-62・AC-64（観点表が「本フェーズでは無検証」と明記）／AC-40・AC-61・AC-65・AC-75・AC-88・AC-90（観点表 2 章が Phase 10 の E2E へ割り当て）
- **⚠️ 2 件**：AC-73（FIND-B01・FIND-B02）／AC-74（FIND-B02）
- **❌ 0 件**

全 90 件の個別判定はレーンB の応答に記録（本ファイルでは集計のみ。詳細が必要な場合は Round 2 で再掲する）。

## Findings（Critical / Major）

### FIND-001: 自動消去時間の期待値を SUT 自身から import しており、AC-80 の「2000ms」が一切束縛されていない
- **観点 / レーン**：① トートロジー検出（MC-1）／レーンA
- **重大度**：Major
- **ファイル**：`apps/web/src/lib/saved-msg.test.ts:13`（import）・`:111`・`:122`・`:179`・`:206`・`:210`・`:217`（使用）／`apps/web/src/lib/saved-msg.ts:51`
- **問題**：期待値が SUT の export（`AUTO_CLEAR_MS`）そのもの。実装が定数を書き換えれば期待値も同時に動くため、**実装がどうであれ必ず PASS する**。ファイル全体を grep しても持続時間としての数値リテラル `2000` は 1 か所も現れない
- **影響**：観点表 1.6 節 6-4 は「AC-80 はここが担保」と明記し、E2E は Phase 5 でコード化していない。**現時点で 2000ms を担保する場所がどこにも無い。**Phase 8 が `AUTO_CLEAR_MS = 5000` に変えても 24 件すべて Green のまま
- **推奨対応**：`it('自動消去の待ち時間は 2000ms（AC-80）', () => expect(AUTO_CLEAR_MS).toBe(2000))` を 1 件追加する、または `:111`・`:122` の期待値をリテラル `2000` に置き換える。**観点表の改変を伴わない**
- **戻り先**：Phase 5（`test-builder`）

### FIND-002: AC-87「`ms` をそのまま渡す」のテストが、入力と期待値に同一定数を使うためハードコード実装を落とせない
- **観点 / レーン**：① トートロジー検出（MC-1）／レーンA
- **重大度**：Major
- **ファイル**：`apps/web/src/lib/saved-msg.test.ts:204-211`
- **問題**：入力 `[{ type: 'setTimeout', ms: AUTO_CLEAR_MS }]` に対し期待値も `[AUTO_CLEAR_MS]`。`runSavedMsgEffects` が `timers.setTimeout(cb, 2000)` とハードコードしても一致する
- **影響**：設計書「実装構造の規定」規定 B の「第 2 引数には副作用の `ms` をそのまま渡す」という pass-through が未検証。FIND-001 と組み合わさると、reducer 側が `ms` を変えても実行側が定数を使ってもどちらも検出されない
- **推奨対応**：入力の `ms` を識別可能な別値（例 `1234`）にし、期待値も `1234` にする。観点表 6-4 は AC-87 としか書いていないため改変にあたらない
- **戻り先**：Phase 5

### FIND-003: AC-87「コールバックが dispatch する」テストが、コールバック外で先行 dispatch する実装を落とせない
- **観点 / レーン**：① トートロジー検出（MC-1）／レーンA
- **重大度**：Major
- **ファイル**：`apps/web/src/lib/saved-msg.test.ts:213-221`
- **問題**：`dispatch` の呼び出しを**コールバック起動後にしか観測していない**。`runSavedMsgEffects` が空コールバックで `setTimeout` し、そのうえで**即座に** `dispatch({ type: 'autoClearFired' })` を呼ぶ実装は、`saved-msg.test.ts` **24 件すべてを PASS する**
- **影響**：この実装ではメッセージが 2 秒後ではなく**即座に消える**（AC-61「日報保存の失敗は自動的に消えない」および AC-80 の実挙動が壊れる）。設計書 規定 B が明示的に禁じている形
- **推奨対応**：コールバック起動**前**に `expect(dispatch.mock.calls).toEqual([])` を挟み、起動後に `[[{ type: 'autoClearFired' }]]` を判定する。あわせて `setTimeoutCalls` が空でないことを明示的に主張し `?.` による黙殺経路を塞ぐ
- **戻り先**：Phase 5

### FIND-004: 1-6③ が Given を主張しておらず、対象欠陥を検証しないまま PASS する経路が残る
- **観点 / レーン**：① トートロジー検出（MC-1）／レーンA
- **重大度**：Major
- **ファイル**：`apps/web/src/server/functions/reports-irreversible.integration.test.ts:250-263`
- **問題**：削除前の状態を一切観測していない。Phase 8 が（AC-27 に反して）実績h 空の行にも `time_entries` を作った場合、件数ベースの存在判定でも delete は成功し、**PASS したまま対象欠陥の検証をやめる**
- **影響**：AC-89 の「存在判定は `daily_reports` で行う」が、他観点（3-8・5-5）の PASS に暗黙依存する構造になる
- **推奨対応**：削除前に `entrySummaryOfDate` と `dailyReportOfDate !== null` を取得し、期待値に `entriesBefore: { count: 0, total: 0 }`・`reportExistsBefore: true` を加える（**同ファイルの 1-5 に手本がある**）。観点表の改変を伴わない
- **戻り先**：Phase 5

### FIND-B01: 5-10 ④「`data` 自体が `null`」が `deleteReportFn` に対して実施されていない
- **観点 / レーン**：③ 受け入れ条件との対応（MC-6）／レーンB
- **重大度**：Major
- **ファイル**：`apps/web/src/server/functions/reports-common.integration.test.ts:558-563`／`apps/web/src/test/report-db-helpers.ts:337-339`
- **問題**：ヘルパー `deleteReport(date)` が常に `{ data: { date } }` で包むため、`deleteReport(undefined)` は `data === null` ではなく `data === { date: undefined }` を渡す。**「`data` が null/undefined でなくオブジェクトであること」の判定を一度も通過していない**
- **影響**：`deleteReportFn` を `.handler(async ({ data }) => { const { date } = data; … })` と null ガードなしで書いた実装は `data = null` で `TypeError` を投げるが、本テスト群では検出できない。設計書が「保存と削除で同じ文言を返すことで**片方だけが検証を実装していない状態を AC で識別できるようにする**」と述べた設計意図が、まさにその「片方」で無効化される
- **推奨対応**：`report-db-helpers.ts` に `data` を素通しする経路（例 `deleteReportRaw(data: unknown)`）を追加し、`deleteReportRaw(null)` と `deleteReportRaw(undefined)` の両方が規範メッセージに完全一致することを判定する。観点表の記載どおりに実装し直すだけであり改変にあたらない
- **戻り先**：Phase 5

### FIND-B02: 5-10 の期待結果「拒否される入力は…DB に触れない」がテストに落ちていない
- **観点 / レーン**：③ 受け入れ条件との対応（MC-6）・④ エッジケース網羅（MC-4）／レーンB
- **重大度**：Major
- **ファイル**：`apps/web/src/server/functions/reports-common.integration.test.ts:542-556`（判定）・`:513-514`（`CLEANUP_DATES`）
- **問題**：観点表 5-10 の期待結果の後半「**DB に触れない**」が欠落し、メッセージしか見ていない。同ファイルは「拒否されるはずの入力が誤って書き込まれた場合の後始末対象」として `CLEANUP_DATES` を用意しており、**誤書き込みの可能性を想定しながらその書き込みを一度も assert していない**
- **影響**：`'2000-1-1'` は PostgreSQL が `2000-01-01` として受理する。日付検証を `DELETE FROM time_entries WHERE date = <生の入力>` の**後**に置いた実装は、規範メッセージを正しく投げながら**利用者の 2000-01-01 の実績を消す**。「検証エラー時に DB へ触れない」を観測しているのは 1-8（上限超過）と 2-5①（長さ超過）だけで、**日付検証パスは観測点ゼロ**
- **推奨対応**：拒否ケースのループ前に対象日付へ既知の `time_entries` / `daily_reports` を仕込み、全拒否入力を通したあとに件数・合計が不変であることを同一 assert に含める。最低限 `'2000-1-1'` に対応する `2000-01-01` を対象にする（既に `CLEANUP_DATES` に入っている）
- **⚠️ 一点のみ人間判断が必要**：AC-74 の「`'2026-02-30'` が `'2026-03-02'` として処理され 3/2 の `time_entries` が削除されない」まで押さえる案は、**観点表 1.0 節 規定 5 の日付割当表への追記＝凍結済み成果物の変更**にあたる
- **戻り先**：Phase 5（`2026-03-02` を追加する場合のみ人間へエスカレーション）

## Minor（1行のみ）

**レーンA**
- FIND-005: 「書き込みが起きないこと」系 5 件が `daily_reports` 行の作成を主張せず、保存が丸ごと no-op でも PASS する（`reports-constraints.integration.test.ts:224,240`／`reports-join.integration.test.ts:361`／`reports-common.integration.test.ts:253,372`）
- FIND-006: 設計書が「関数名・型の詳細は実装者の裁量」と明記しているのに、テストが `savedMsgReducer` / `runSavedMsgEffects` / `AUTO_CLEAR_MS` / `SavedMsgState` のフィールド名まで凍結している（`saved-msg.test.ts:10-18`）
- FIND-007: 設計書が名指しするのは `normalizeName` のみだが、`report-normalize.ts` の 8 シンボル・型・モジュールパスを Phase 5 が発明して 94 件で凍結している（`report-normalize.test.ts:9-18`）
- FIND-008: 設計書は長さ超過の列挙順を規定していないが、テストが 取引先名 → プロジェクト名 → タスク名 の順を固定している（`report-normalize.test.ts:263-274`）
- FIND-009: `process.env.TZ = originalTz` は `originalTz` が `undefined` のとき**文字列 `"undefined"`** を代入する（Node 22 で実測）。TZ 未設定環境では復元が壊れる（`reports-common.integration.test.ts:533,538`）
- FIND-010: 観点表 規定 9 が「SQLSTATE は診断情報」と規定しているのに、2-1・2-2①・2-3 が `sqlState: '23505'` を `toEqual` の主判定に含めている（`reports-constraints.integration.test.ts:77,101,139`）
- FIND-011: 4-4 の `orphanTimeEntries` は観点表 R2-M1 が「違反実装を一切検出できない」と実測結論づけた判定であり、無検出と分かっているアサーションが残置されている（`reports-transaction.integration.test.ts:229`）

**レーンB**
- FIND-B03: 観点表 規定 2 の「名前列の集合一致まで判定する」に対し、2-1・2-2①②・2-3 は `.length` のみ、4-9 の `projects` も件数のみ
- FIND-B04: 5-10 の `CLEANUP_DATES` が観点表の日付割当表に無い `'2000-01-01'`（＝E2E-1 のセンチネル日付）を後始末対象に加えている
- FIND-B05: 1-7 の期待結果「既存 2 件が全行そのまま残る（`hours` も一致）」を件数・合計・`title` 集合で代替しており、行ごとの `hours` 一致は未判定
- FIND-B06: `src/server/report-normalize.ts` の配置と 8 個の関数名は設計書・観点表のいずれも規定していない仮置き（FIND-007 と同旨）
- FIND-B07: `saved-msg.test.ts` は reducer の次状態 `timerId` を全イベントで `null` に固定しているが、設計書は `setTimeout` 出力時を「未確定」とし値を規定していない
- FIND-B08: 5-6 の `clientsByPrefix('')` は `LIKE '%'` でテーブル全体を読む
- FIND-B09: 6-2 の `hasRequireSessionMiddleware` は最初の `.middleware([...])` 1 個しか見ないため、スライス内に別の `.middleware` が先行すると偽 FAIL になる

## レビュー観点ごとの判定

| 観点 | レーン | 判定 | 裏付け |
|---|---|---|---|
| ① トートロジー検出（MC-1） | A | **FAIL** | Major 4 件。スタブ返却値の直接 assert はゼロ・真偽値スタブのキャスト方式は有効・スタブに実ロジック混入なし、は確認済 |
| ② 実装詳細の過剰束縛 | A | FAIL（Minor のみ） | R-3「アプリ側で丸めない」は束縛できている。関数名・配置の凍結が Minor 3 件 |
| ③ 受け入れ条件との対応（MC-6） | B | **FAIL** | Major 2 件。✅74 / ⚠️2 / ❌0 / N/A 8 |
| ④ エッジケース・例外系の網羅（MC-4） | B | **FAIL** | FIND-B02 と重複。R-2 判定 1〜4・日付 3 条件・閏年 4 分岐・TZ 3 通りは網羅を確認。未決事項の素通しなし |
| ⑤ セキュリティ・品質観点（MC-2・3・5） | C | **未レビュー** | **レーンC が API のセッション上限で途中終了** |
| ⑥ Red Phase log の妥当性（MC-9） | C | **未レビュー** | 同上 |

## レーンが PASS と判定した主な項目（裏付け）

- **スタブ返却値の直接 assert はゼロ**（レーンA）：`report-normalize.ts` / `saved-msg.ts` の全ダミー値を 118 件の単体テストの全期待値と突き合わせて一致ゼロを確認
- **真偽値スタブのキャスト方式は有効**（レーンA）：`STUB as unknown as boolean` により `toBe(true)` 22 件・`toBe(false)` 24 件が**両方向とも** FAIL する
- **スタブに実ロジック混入なし**（レーンA）：8 関数すべてが単一 `return` の固定リテラル。条件分岐・ループ・`replace`/`map`/`filter` は 0 件
- **R-1 の空白集合が実文字で書かれている**（レーンA）：NBSP（U+00A0）・U+3000・ZWSP（U+200B）をコードポイント単位で確認
- **4-5②④の「ロックが残らない」は③⑤と対**（レーンA）：④が①とは別の陽性対照（DELETE_DATE のキー）を自前で持つ点が観点表 R4-M6 の要求を満たす
- **観点表 1.0 節 規定 1〜9 の実装**（レーンB）：接頭辞は全 34 describe が規則に一致。日付割当は規定 5 の表と 1 件も齟齬なし。親子辿りの後始末・規定 4 の 3 テーブル対応・規定 9 の `cause?.code ?? code` を実装で確認
- **AC-72（Phase 6 で重点再確認せよと名指しされた 4-5 delete 側）**（レーンB）：④の専用陽性対照・⑤の `FOR UPDATE` ブロックまで観点表どおり。シフト・論理積は SQL 側評価で JS の 32 ビット問題を回避
- **未決事項の素通しなし**（レーンB）：設計書 未決事項 No.1 に依存するテストは存在しない。接頭辞を付けられない固定名はすべて `snapshotFixedNames` の対象に列挙

## 司令塔による裁定（Round 1）

1. **レーンC が未消化である。**セキュリティ観点（`requireSession` の退行検出・後始末の安全性・並行性土台の規定遵守）と Red Phase 証拠の妥当性は**レビューされていない**。`flow-review-policy` の must-catch のうち MC-2・MC-3・MC-5・MC-9 が未チェックのまま残る。**Round 2 で必ず実施すること**
2. **レーンA の重要な指摘**：`test-builder` の「スタブ段階で PASS した 19 件」というスクリーニング軸は、**「FAIL したがトートロジー的に弱い」テストを取りこぼす**。実際、19 件のリストに入っていない `saved-msg.test.ts` に最も重いトートロジー（FIND-001〜003）が残っていた。Phase 7 の人間レビューでは 19 件のリストだけを見ても到達できない
3. **FIND-B02 の一点（AC-74 の `2026-03-02` を押さえる案）のみ**、凍結済み観点表の日付割当表への追記＝人間判断が必要
