# テスト 敵対的レビュー結果（Phase 6 Round 4・差分レビュー）

- **対象コミット**：`2d63712`（Round 3 の Critical 1・Major 2 の修正）／比較元 `a2b74e5`
- **レビュー日時**：2026-08-15
- **方式**：2 レーン構成（レーンC が DB を占有し、レーンA+B 統合を DB 不使用の条件で並行実行）。観点は 6 つとも維持
- **総合判定**：**FAIL**（Critical 0・Major 1・Minor 4）

**Critical がゼロになった（Round 2 以降で初めて）。**

## Round 3 findings の解消状況

| Round 3 の finding | 判定 | 裏付け |
|---|---|---|
| FIND-LC-C01（Critical・ガードB の DB 名判定が迂回される） | **解消** | レーンC が postgres-js 3.4.8 の実チェーンと 16 パターンで突き合わせて一致を確認。大文字 DB 名がケースフォールドされないこと（`WORKHUB_TEST` で `database "WORKHUB_TEST" does not exist`）も実測。司令塔も 5 形式で拒否／通過を実測済み |
| FIND-LC-M01（Major・ガードが import 依存） | **解消** | レーンC が `auth.integration.test.ts`（ヘルパー未 import）を dev DB 名で実行 → **exit code 1** で FAIL 終了することを実測。緑での見逃しなし。二重呼び出しの冪等性も確認 |
| FIND-R3B-01（Major・規定 3 の防御が検証不能） | **解消** | レーンA+B が違反実装（全件返却）を注入して **5 件中 3 件 FAIL** を実測。復元も `git diff` 空で確認 |

## Major

### FIND-R4-M02: 規定 10 ガードBの中核ロジック（`resolveEffectiveDbName`）に自動テストが存在しない

- **観点 / レーン**：MC-1 の類推適用／レーンA+B
- **重大度**：Major
- **ファイル**：`apps/web/src/test/assert-not-dev-database.ts:38-58`
- **問題**：`resolveEffectiveDbName(url: string): string` は DB にも環境変数にも副作用が無い純粋関数であり、`selectDeleteTargetIds` とまったく同じ条件（`npm run test` レベルで直接検証可能）を満たすのに、単体テストが 1 件も無い（`grep -rl "assert-not-dev-database" apps/web/src --include="*.test.ts"` が空）
- **影響**：**規定 10 ガードBの心臓部＝前回の Critical（FIND-LC-C01：開発 DB への誤接続で日報がサイレント破壊される）を防ぐロジックそのもの**が自動テストで守られていない。将来 fallback の優先順位が崩れたり fail-closed が fail-open に戻されたりしても、`npm run test` はもちろん `npm run test:integration` も検出できない（CI は常に空の `workhub_test` に接続するため）。**FIND-R3B-01 を Major とした論理がそのまま当てはまる**
- **ロジック自体は正しいことが独立検証済み**：レーンA+B が `node_modules/postgres/src/index.js:469` の実ソース（`o.database || o.db || (url.pathname||'').slice(1) || env.PGDATABASE || user`）を読み、`pathname → PGDATABASE → username` の連鎖と一致することを確認。`o.database` / `o.db` を対象外とした判断（本リポジトリは `postgres(urlString)` を文字列 1 本で呼ぶため常に空）も妥当。**正しさではなく、正しさを将来にわたって保証する仕組みの欠如が指摘である**
- **推奨対応**：`report-db-helpers.test.ts` と同じ形式で単体テストを追加する（パス省略・末尾スラッシュのみ・`PGDATABASE` フォールバック・username フォールバック・解析不能時の fail-closed・全フォールバック枯渇時の fail-closed の 6 ケース）。**凍結済み成果物の変更は不要**
- **戻り先**：Phase 5（`test-builder`）

## Minor

- **FIND-R4-M03**（同型欠陥の横展開）：`report-db-helpers.ts` の `deleteNewRows`（規定 4 の固定名防御）にも `selectDeleteTargetIds` 抽出前と同じインラインの filter が残っており、**FIND-R3B-01 と同型の検出力空洞**が未修正のまま存在する（今回の差分の対象外のため Minor 判定だが、同じ修正の横展開で閉じられる）
- **FIND-R4-M01**：`selectDeleteTargetIds` の 5 件テストは、`Set.has` による完全一致ではなく**部分文字列一致（`includes`）で判定する別実装でも全件通過する**（レーンA+B が実測）。`time_entries.id` / `daily_reports.id` は固定長 UUID のため本番では実害なしだが、テストベクタを強化すれば閉じられる
- **FIND-R4-LC-M01**：`resolveEffectiveDbName` は postgres-js の `user` フォールバック連鎖（`url.username → PGUSERNAME → PGUSER → osUsername()`）のうち `PGUSERNAME` / `PGUSER` / OS ユーザー名の分を実装せず fail-closed に短絡している。**安全側（過検知）であり、実装すると現在拒否している一部のケースが通過するようになる（＝より緩くなる）ため、修正しない。**`.env.example` / `docker-compose.yml` / `ci.yml` はすべて接続文字列にユーザー名を含むため到達しない。**この判断を文書化して通過とする**
- **FIND-R4-LC-M02**：`assert-not-dev-database.ts` のエラーメッセージとコメントが実装移動後も `[report-db-helpers]` プレフィックス・旧ファイル名を参照したままで、実装の所在と一致しない

## レーンC が PASS と判定した項目（実測の裏付け）

| 検証 | 実測 |
|---|---|
| ガードB の 16 パターン突き合わせ | postgresql スキーム・IPv6・%エンコード・パストラバーサル・大文字・`PGDATABASE` 併用・複数ホスト等。**postgres-js の実チェーンと一致**（fail-closed 短絡の 1 件を除く＝FIND-R4-LC-M01） |
| fail-closed の偽陽性 | `.env.example` / `docker-compose.yml` / `ci.yml` の 3 箇所とも `DATABASE_URL` に user 部を含むため fail-closed 分岐に到達しない。**偽陽性なし** |
| 単体側の `setupFiles` | `vitest.config.ts` は `setupFiles: []`。DB を触る単体テストは 0 件 |
| setupFiles 単独でのガードB発火 | `auth.integration.test.ts` を dev DB 名で実行 → **exit code 1**・`Test Files 1 failed`。緑での見逃しなし |
| 二重呼び出しの冪等性 | `reports-common.integration.test.ts` を正 DB で実行 → 例外なく 18 FAIL / 6 PASS で完走 |
| ガードA の実効性（差分後） | `2026-03-02` に模擬データ → 5 ファイル即時中断。`id` / `note` / `raw_data` すべて不変。他テーブル残留 0 |
| GUARD_DATES の動的網羅 | トリガーによる観測で **66 日付・範囲外への書き込みゼロ**（Round 3 と同結果を差分後に再確認） |
| 非 GUARD_DATES 日付の既存データ | `2050-06-15` / `16` に 6 行投入 → フル実行後 **md5 ハッシュ完全一致・件数変化なし** |
| `requireSession` の退行検出 | 3 変異とも**狙った 1 テストのみ**が新規 FAIL。他 14 件のベースライン失敗は不変（`diff` で確認） |
| Red Phase 証拠 | 単体 132 FAIL / 69 PASS、結合 56 FAIL / 19 PASS、`db:push` = `No changes detected`、`check-types` PASS、import エラー 0 件、スタブ 2 ファイルに実ロジック混入なし、S-1〜S-3 未適用、実行後の残留 0 件・advisory lock 0 件 |

## 収束判定（Round 4）

**未収束（Critical 0・Major 1）。**Round 4 / 上限 5 周。

**Critical がゼロになり、Major も 1 件（しかも「テストを 1 本足せば閉じる」種類）まで減った。**振動ではなく収束に向かっている。

FIND-R4-M02 は凍結済み成果物の変更を要さないため人間ゲートへの再エスカレーションは不要。あわせて安価に閉じられる Minor 3 件（FIND-R4-M03・M01・LC-M02）も同時に修正し、Round 5 の差分レビューへ進む。
