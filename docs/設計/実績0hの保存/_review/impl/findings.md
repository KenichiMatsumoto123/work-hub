# Phase 10 実装レビュー findings（実績0hの保存）

- 機能：実績0hの保存
- 較正：敵対的（探索）／報告閾値：Critical / Major のみ
- レーン並列：有効（A 仕様忠実性 / B セキュリティ / C テストのすり抜け）
- 実装承認: **スキップ（フロー設定）／収束をもって承認**（`_flow-config.md`。Major の文書化通過は未使用）

## Round 1（2026-08-16）

- **総合判定**: PASS
- **Critical**: 0
- **Major**: 0
- **マージ**: 3レーンとも findings 該当なし。矛盾なし。統合すべき重複指摘なし

### レーンA: 仕様忠実性（must-catch MC-8）

- **対象**:
  - `apps/web/src/server/report-normalize.ts`（`classifyActualHours`）
  - `apps/web/src/server/schema/tasks.ts`（`chk_hours_non_negative` / `chk_planned_hours_positive`）
  - `apps/web/src/server/functions/reports.ts`（`collectRows` / `saveReportFn` / `resolveMastersAndInsertEntries`）
  - 突き合わせ用テスト: `report-normalize.test.ts` / `reports.test.ts` / `reports-constraints.integration.test.ts` / `reports-common.integration.test.ts`
  - 設計: `docs/設計/実績0hの保存/実績0hの保存_設計書.md`（AC-Z01〜Z20、R-2、S-Z1、非ゴール）・`_flow-config.md`・`_review/test/findings.md`
  - 非ゴール確認: `report-generator.ts` / `MonthlyTimesheetTable.tsx` / `TaskRow.tsx`
- **総合判定**: PASS

| 観点 | 判定 | 指摘数 |
|---|---|---|
| 仕様忠実性 | PASS | 0件 |
| セキュリティ | PASS（担当外・偶発確認のみ） | 0件 |
| テストのすり抜け | PASS（担当外・偶発確認のみ） | 0件 |

- **仕様忠実性（MC-8）**: `classifyActualHours`（51–62行）は R-2 適用順どおり NaN skip → `value < 0` skip（`Object.is(-0)` なし）→ `>= 24.005` over → 残りを target かつ `value` は parseFloat のまま。S-Z1 は `time_entries` のみ `hours >= 0` に差し替え（116行）、`chk_planned_hours_positive` は `> 0` のまま（141–144行）。`collectRows` は skip 以外を対象行に載せ `hours === 0` を落としていない（108–135行）。INSERT は件数判定（418行）で `String(row.hours)`（426行。`String(-0)==="0"`、指数表記変換なし）。未テスト AC（Z01 保存経路・Z07〜Z12・Z17〜Z20 等）も実装上の乖離なし。画面・`getProjectSummary` の `parseFloat > 0`・月次表・`deleteReportFn`・`tasks.actual_hours` 更新は非ゴールどおり未拡張。
- **セキュリティ（担当外）**: `saveReportFn` の `requireSession` は維持。認可・PII の新規経路は見当たらず。
- **テストのすり抜け（担当外）**: 5.5 N/A の保存・再保存・直 INSERT 経路を実装で追ったが、仕様乖離は見つからなかった。「テストが無い」こと自体は報告しない。

**Findings**: 該当なし

### レーンB: セキュリティ（must-catch MC-2・MC-3）

- **対象**:
  - 実装: `apps/web/src/server/report-normalize.ts` / `apps/web/src/server/schema/tasks.ts` / `apps/web/src/server/functions/reports.ts` / `apps/web/src/server/middleware/require-session.ts`
  - 関連（認可・PII・XSS の裏付け）: `apps/web/src/server/schema/reports.ts` / `apps/web/src/server/schema/master.ts` / `apps/web/src/lib/types.ts` / `apps/web/src/routes/index.tsx`
  - テスト: `report-normalize.test.ts` / `reports.test.ts` / `reports-constraints.integration.test.ts` / `reports-common.integration.test.ts`
  - 設計: `docs/設計/実績0hの保存/実績0hの保存_設計書.md` / `_flow-config.md`（親設計セキュリティ節も照合）
- **総合判定**: PASS

| 観点 | 判定 | 指摘数 |
|---|---|---|
| 仕様忠実性 | 担当外 | 0件 |
| セキュリティ | PASS | 0件 |
| テストのすり抜け | 担当外 | 0件 |

- **MC-2（PII 3層）・非該当の根拠**: トリガー表は「氏名以外の連絡先・要配慮個人情報」を PII とする（`テストレベル選定トリガー表.md`）。`DailyReportData`（`types.ts:19-29`）に email/phone は無く、扱うのは名前・工数・所感。`saveReportFn` は `{ success: true }` のみ返却（`reports.ts:517`）し `context.user` を受け取らない（`reports.ts:457`）。401 は `{ error: 'UNAUTHORIZED' }`（`require-session.ts:19-22`）。`reports.ts` にログ出力は無い。エラー文の名前・工数（`reports.ts:149,157-160`）は設計上 PII 非該当（設計書「テストレベル判定」PII 行、親設計 964 行）。モック汚染層は除外対象の PII フィールド自体が無いため適用不可（`reports.test.ts` の db モックは throw 専用でユーザーレコードを返さない）。
- **MC-3（認可 2層）・非該当の根拠**: `daily_reports` / `time_entries` / `tasks` / `clients` / `projects` に `user_id` / `company_id` は無い（`schema/reports.ts`・`schema/tasks.ts`・`schema/master.ts`。`user_id` は `schema/auth.ts` のセッション系のみ）。DELETE の where は検証済み日付のみ（`reports.ts:459-461,511` と `525-545` の `eq(timeEntries.date, …)`）。他社混在モックを置く境界がデータモデル上存在しない（設計書 329 行、親 939-941・963 行）。ログイン必須は `requireSession` が `saveReportFn` / `deleteReportFn` / 取得系に付いている（`reports.ts:49,60,455,521`、`reports.test.ts` 6-2 の静的検証）が、セッションユーザーでの行絞り込みは行わない（既存の共有モデル。本差分で新設していない）。
- **入力検証・負数混入**: 判定 2 は `value < 0` で skip（`report-normalize.ts:56-57`）。INSERT の `hours` は `kind === 'target'` の `classification.value` を `String()` した値のみ（`reports.ts:123-124,420-429`）。CHECK は `chk_hours_non_negative`（`hours >= 0`、`tasks.ts:116`）。予定側 `chk_planned_hours_positive`（`> 0`）は維持（`tasks.ts:141-144`）。アプリ経路の負数は CHECK に到達しない。直 INSERT の丸め後 `0.00`（AC-Z18b）は設計どおり CHECK の対象が格納値であるため、アプリ判定 2 の迂回にはならない。NaN は判定 1 で skip（`report-normalize.ts:54-55`）。CHECK を NaN 防波堤にしていない（設計書 226 行）。
- **インジェクション**: SQL は Drizzle の `eq` / `inArray` / `sql\`...\`` のプレースホルダ（`reports.ts:298-305,447,511`）。日付は `YYYY-MM-DD` 実在日のみ（`report-normalize.ts:182-196`）。コマンド実行・ファイルパス結合は保存経路に無い。XSS はエラー文を React テキストノードで描画（`index.tsx:239-248`、`dangerouslySetInnerHTML` なし）。
- **N+1**: マスタ解決はキー集合のバッチ SELECT/INSERT（`resolveBatchWithRetry`、`reports.ts:192-221,349-429`）。`time_entries` は 1 回の複数行 INSERT。0h で対象行が増えてもクエリ本数は行数比例にならない。実運用規模（設計上 10〜30 行）で顕在化する N+1 は無い。
- **担当外**: 仕様忠実性・テストすり抜けは体系確認していない。Critical 級の偶発発見は無し。

**Findings**: 該当なし

### レーンC: テストのすり抜け（must-catch MC-7・MC-9）

- **対象**:
  - 実装: `apps/web/src/server/report-normalize.ts` / `apps/web/src/server/schema/tasks.ts` / `apps/web/src/server/functions/reports.ts`
  - テスト: `apps/web/src/server/report-normalize.test.ts` / `apps/web/src/server/functions/reports.test.ts` / `apps/web/src/server/functions/reports-constraints.integration.test.ts` / `apps/web/src/server/functions/reports-common.integration.test.ts` / `apps/web/e2e/effort-normalize.test.ts`
  - 設計: `docs/設計/実績0hの保存/実績0hの保存_設計書.md` / `_review/test/findings.md` / `_flow-config.md`
  - 補助（未検証経路の到達先）: `reports-irreversible.integration.test.ts` / `reports-transaction.integration.test.ts` / `report-db-helpers.ts` の `saveReport` / `require-session.ts`
- **総合判定**: PASS

| 観点 | 判定 | 指摘数 |
|---|---|---|
| 仕様忠実性 | 担当外 | 0件（Critical 級の発見なし） |
| セキュリティ | 担当外 | 0件（Critical 級の発見なし） |
| テストのすり抜け | PASS | 0件 |

- **MC-7 / テストがカバーしている経路**: 単体は判定1（NaN skip）・判定2（`value < 0` skip）・判定3（`>= 24.005` over）・判定4（`"0"` / `"0.0"` / `"0h"` / `"-0"` / `"0.004"` / `"0x10"` / 数値 `0` が target）。結合内部は AC-Z13（0h+256文字で親テンプレ・DBモックに触れる前）・AC-Z14（空欄+300文字で `transaction` に到達）・`requireSession` 静的検証。結合(DB)は `"0.004"` / `"0.0000001"` → `'0.00'`（constraints 2-7）、`"0x10"` → `'0.00'`（common 5-7②。`parseFloat` が `0` なので `hours: String(0)` の INSERT と同一）、AC-Z16 混在3件・合計10.18（0.00行を含む）、5-5 の空/非数/`-3` skip、3-8 の予定のみマスタ非作成、1-8 の検証エラーで既存行不変、1-11/1-12 の DELETE+再INSERT、5-1 の対象行0件。E2E-1〜7 は `1.5` / 空 / `25` / 未認証401。
- **MC-9**: `saveReportFn` / `deleteReportFn` は親どおり `createServerFn` + `.middleware([requireSession])`（`reports.ts:454-456, 520-521`）。検証失敗は `throw new Error(親テンプレ)`（構造1行・上限見出し+列挙・長さ見出し+列挙、AC-Z13 が 0h でも一致）。成功は `{ success: true }`。`reportStorage.save` は `Error.message` を `error` に載せる既存ラッパーのまま。認可ヘルパーの差し替え・401 JSON 形式の変更なし。
- **列挙した未検証経路**（5.5 スキップ分を含む。欠測自体は指摘にしない。実装を読んで欠陥なしと判断した根拠を括弧内に記す）:
  1. AC-Z01 専用の `"0"` / `"0.0"` / `"0h"` → DB `hours="0.00"`（分類は単体のみ。実行時は `"0x10"` 結合と同じ `parseFloat===0` → `String(0)` INSERT。`reports.ts:123-124, 426`）
  2. AC-Z05 `"-0"` の保存（単体のみ。`String(-0)==="0"` で 1 と同じ INSERT。判定2は `value < 0` のため `-0` は skip しない。`report-normalize.ts:56-61`）
  3. AC-Z06 数値型 `0` の保存（`toInputString(0)==="0"`。`report-normalize.ts:31-33`）
  4. AC-Z07 の `projects` 非作成 assert（5-5 は clients/tasks のみ。`collectRows` は skip で `continue` し `resolveTaskIdentity` に入らない。`reports.ts:115`。3-8 が空実績で projects=0 を確認）
  5. AC-Z08 `"-0.004"` / `"-Infinity"` の保存（5-5 の `"-3"` と同一の判定2 skip 分岐）
  6. AC-Z09 予定hのみ専用ケース（`collectRows` は `actualHours` のみ参照。3-8 / 1-6③ が空実績と同型）
  7. AC-Z09b 予定h `"8"` + 実績 `"0"`（`plannedHours` は走査対象外。実績 `"0"` は判定4）
  8. AC-Z10 / AC-Z10b の 0h 専用マスタ解決（`resolveMastersAndInsertEntries` は hours 値で type/JOIN を分岐しない。0x10 が 0.00 行+タスク JOIN、5-4 が名前欠損の識別を正の実績hで確認）
  9. AC-Z11 再保存 7.5→0（1-12 が正の値の置換。DELETE は `date` のみ。`reports.ts:510-514`。INSERT は 1 と同じ `"0"`）
  10. AC-Z12 再保存 0→空（1-11 が行減の再保存。空 `targetRows` は `length===0` で INSERT しない。`reports.ts:418`。5-1 が同 early return）
  11. AC-Z17〜Z20 直 INSERT / 情報スキーマ（スキーマは `chk_hours_non_negative`（`hours >= 0`、`tasks.ts:116`）と予定側 `chk_planned_hours_positive`（`> 0`、`:141-144`）。アプリ経路の 0.00 INSERT は 2-7 / 5-7② / 5-11 が通過しているため旧 `hours > 0` が残存して 0.00 を拒否する状態ではない）
  12. `collectRows` の `projects ?? []` / `tasks ?? []`（`isValidReportStructure` 通過後は配列必須。`reports.ts:112-113, 459-461`）
  13. 0h のみ日報で `targetRows.length === 0` 側（0h は length≥1 なので INSERT 側。空側は 5-1）
  14. 検証エラーで `db.transaction` に入らない経路のうち 0h 以外の組み合わせ（0h+長さは AC-Z13。上限は 1-8 / `reports.test.ts`。`reports.ts:467-470` が throw 後に transaction を呼ばない）
  15. `saveReportFn` の catch（存在しない。失敗は drizzle の transaction rollback。1-7 が部分失敗の原子性を確認）
  16. `deleteReportFn` による 0.00 行削除（`WHERE date` のみ。`reports.ts:544-545`。1-5 が正の値で同 SQL）
  17. 並行保存の 0h 入力（ロックキーは日付。`reports.ts:446-447`。4-2 が正の値）
  18. E2E の 0h 入力（親 E2E-1〜7 のみ。UI は `TaskRow` が文字列のまま `saveReportFn({ data })` に渡す。サーバ側の 0 分類・INSERT は上記結合が担保）
  19. `clientId === undefined` の continue / タスク未解決 throw（`reports.ts:373, 423-425`。hours 非依存。親結合が正の値で通る）
  20. 判定4の fallthrough（NaN / `< 0` / `>= 24.005` の残余。単体判定4が通過。NaN は判定1が先）

**Findings**: 該当なし

未検証経路を列挙したうえで、0 を偽値として落とす分岐・合計0で INSERT を省略する分岐・skip 行のマスタ作成・検証失敗後の transaction 侵入・CHECK 名/条件の取り違え・`requireSession` / エラーテンプレの規約逸脱は、実装上存在しなかった。5.5 未コード化の保存・直 INSERT・再保存専用ケースは、到達するコードが既存の通過済み経路と同一か、hours 値で分岐していない。

## 参考（ゲート対象外）

なし（各レーンとも報告閾値外の指摘を返していない）
