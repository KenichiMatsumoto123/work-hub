# Red Phase Evidence

- 機能：工数実績の正規化保存
- 実施日時：2026-08-15
- テスト作成：`test-builder`（fresh context のサブエージェント）
- **Red Phase 検証：司令塔が独立に再実行**（ワーカーの自己申告は採用していない）
- 実行コマンド：`npm run test` ／ `DATABASE_URL='postgres://workhub@127.0.0.1:5433/workhub_test' npm run test:integration`

## 検証前に行った環境の是正（重要）

`test-builder` の報告により、**テスト DB に設計書の S-1〜S-3（ユニーク制約 3 本）が適用済み**であることが判明した。これは Phase 8 で実装されるべきもので、スキーマ定義（`schema/master.ts` / `schema/tasks.ts`）には存在しない。Round 4 のレビュアーが実測のために追加したものが残っていた。

このまま測ると制約に依存するテストが偽の PASS を返すため、**司令塔が 3 本を DROP し、`db:push` が `No changes detected` を返す（スキーマ定義と一致する）状態に戻してから検証した。**

```
DROP 前：clients_name_unique / projects_client_name_unique / tasks_pj_cl_title_unique が存在
DROP 後：daily_reports_date_unique / technology_tags_name_unique のみ（いずれも既存スキーマ由来）
db:push → No changes detected
```

この是正により、`test-builder` の申告（新規 53 FAIL / 17 PASS）に対し司令塔の実測は **56 FAIL / 14 PASS** となった。差の 3 件は 2-1・2-2①・2-3 が PASS から FAIL に転じたものであり、**是正が正しく効いている**。

## マーカー

| 項目 | 結果 |
|---|---|
| new-feature-tests（単体・結合内部） | **FAIL**（新規 137 件中 **132 件 FAIL** / 5 件 PASS） |
| new-feature-tests（結合 DB込み） | **FAIL**（新規 70 件中 **56 件 FAIL** / 14 件 PASS） |
| regression-baseline（単体・結合内部） | **PASS**（既存 58 件・6 ファイル全件） |
| regression-baseline（結合 DB込み） | **PASS**（既存 5 件・`auth.integration.test.ts`） |
| impl-files-unchanged | **確認済**（`git status` の変更は新規 12 ファイルのみ。既存の実装・テストは無変更） |
| 型チェック | **PASS**（`npm run check-types` = `tsc --noEmit` 成功） |
| スタブに実ロジックが無いこと | **確認済**（`report-normalize.ts` に条件分岐・ループ・`map`/`filter`/`replace` が 0 件。固定ダミー返却のみ） |

## 新規テストの失敗内訳

| テストファイル | 件数 | FAIL | 主な失敗理由 |
|---|---|---|---|
| `src/server/report-normalize.test.ts` | 94 | 94 | スタブの固定ダミー返却に対する期待値不一致 |
| `src/lib/saved-msg.test.ts` | 24 | 24 | 同上 |
| `src/server/functions/reports.test.ts` | 19 | 14 | 同上（静的検証 5 件は PASS。下記参照） |
| `reports-irreversible.integration.test.ts` | 13 | 11 | 同上 |
| `reports-constraints.integration.test.ts` | 15 | 14 | 同上 |
| `reports-join.integration.test.ts` | 9 | 8 | 同上 |
| `reports-transaction.integration.test.ts` | 9 | 6 | 同上 |
| `reports-common.integration.test.ts` | 24 | 17 | 同上 |

**失敗はすべて `expected <ダミー値> to be <期待値>` 形式の期待値不一致であり、import エラー型の一括 FAIL はゼロ。**スタブ最小実装方式（2026-07-12 決定）の要件を満たす。

## スタブ段階で PASS したテスト（19 件）

`test-builder` は 22 件と報告したが、環境是正後は **19 件**（制約依存の 3 件が FAIL に転じたため）。いずれも**観点表を改変しない限り FAIL 化できない**と `test-builder` が判断したもので、司令塔もこれを妥当と認める。

| 分類 | 件数 | 該当観点 | PASS する理由 |
|---|---|---|---|
| 退行検出（対象が既に正しい） | 5 | 6-2（静的検証 3 ＋ 走査ヘルパーの自己検証 2） | 現行 `reports.ts` が既に両関数に `.middleware([requireSession])` を持つ。**PASS が正しい状態**であり、Phase 8 での脱落を落とすためのテスト |
| 「書き込みが起きないこと」が期待結果 | 8 | 1-6③・2-7（`"0.004"`/`"0.0000001"`）・3-8・5-1①②・5-5・5-7② | 未実装コードは何も書かないため期待結果を自明に満たす |
| 現行挙動の維持が期待結果 | 2 | 5-9（AC-04・AC-05） | 「`raw_data`・既存カラムを変えないこと」が AC のため現行実装で PASS する |
| ロック不在／陽性対照 | 3 | 4-5①（陽性対照・観点表が要求）・4-5②④ | ロックを取らない現行実装では「完了後に残らない」が自明に真。保持側は③⑤が FAIL で担保 |
| 制約の非該当 | 1 | 2-2② | 「別 `client_id` なら成功する」が期待結果のため制約の有無によらず PASS |

**これらは Phase 6（テスト敵対的レビュー）でトートロジー疑いとして重点確認する。**

## 後始末の検証（司令塔が実測）

結合(DB込み)テストの実行後：

```
clients=0 projects=0 tasks=0 time_entries=0 daily_reports=0
advisory_locks=0
tmp_constraints=0
```

観点表 1.0 節の規定 3（親子辿りの削除）・規定 4（保存前に存在しなかった場合のみ削除）・規定 8（冪等 DDL）・土台の規定 6（確実なロック解放）が**全経路で機能している**。unhandledRejection も発生していない（規定 3 の `.catch()` 起動時装着が効いている）。

> **【2026-08-15 追記・上記の判定は誤りだった】**
> ここで確認したのは「**テストが作ったデータが残らないこと**」だけであり、「**テストが作っていないデータを消さないこと**」は測っていなかった。Phase 6 Round 2 のレーンC が後者を実測し、`deleteByDates` が日付だけで `time_entries` / `daily_reports` を無条件 DELETE するため、**利用者の実データを破壊する**ことが判明した（FIND-C01・Critical）。規定 4 の「保存前に存在しなかった場合のみ削除」防御はマスタ 3 テーブルにしか実装されていない。詳細は `findings-round2.md` を参照。**「全経路で機能している」という上記の記述は撤回する。**

## Phase 8 への申し送り（`test-builder` からの報告を司令塔が確認）

1. **S-1〜S-3 をスキーマ定義に追加すること。**`schema/master.ts` / `schema/tasks.ts` に未記載であり、追加しないと `npm run db:push` が制約を作らず、2-1〜2-3 と 3-1 が退行を検出できなくなる
2. **スタブの配置・関数名は仮置き**である（`src/server/report-normalize.ts` = R-1〜R-7、`src/lib/saved-msg.ts` = reducer・副作用実行関数）。設計書が場所を規定しているのは `src/lib/` への reducer 切り出しのみ。配置を変える場合はテスト側の import 修正が要る
3. 真偽値を返す 2 関数（`isValidReportDate` / `isValidReportStructure`）のスタブは、ダミー文字列を `boolean` にキャストして返している（`true`/`false` のどちらでもトートロジー PASS が出るため）。Phase 8 で全置換する

## Phase 6 Round 1 修正後の再検証（司令塔が独立に実測・2026-08-15）

Round 1 の Major 6 件（FIND-001〜004・B01・B02）＋ Minor 2 件（FIND-009・B09）の修正後、**司令塔が 4 コマンドすべてを自分で再実行**した。

| 項目 | Round 1 修正前 | 修正後（司令塔の実測） | 差分の説明 |
|---|---|---|---|
| `npm run check-types` | PASS | **PASS** | — |
| `npm run test`（単体・結合内部） | 132 FAIL / 63 PASS（196） | **132 FAIL / 64 PASS（196 件）** | PASS +1 は FIND-B09 の回帰テスト（`hasRequireSessionMiddleware` が走査ヘルパー自身の自己検証であり SUT に依存しないため Red Phase でも PASS するのが正しい） |
| `npm run test:integration`（DB込み） | 56 FAIL / 19 PASS（75） | **56 FAIL / 19 PASS（75）** | 件数一致。FIND-B02・B01 の修正は既存テストの内容を強化したもので件数を増やしていない |
| `npm run db:push` | No changes detected | **No changes detected** | スキーマ汚染なし |

**Red Phase の性質が保たれていることの確認（司令塔の実測）：**

- **import エラー型の失敗 0 件**（`Cannot find module` / `Failed to resolve import` / `does not provide an export` を grep して 0）
- 修正した 5-10 の 3 テストはいずれも `expected … to deeply equal …` の**期待値不一致**で FAIL しており、arrange 中の想定外 throw では落ちていない
- **スタブ 2 ファイルは無変更**（`git diff HEAD -- report-normalize.ts saved-msg.ts` が空）。`AUTO_CLEAR_MS = 2000` は復元済み、`report-normalize.ts` は 8 関数＝単一 `return` 8 個のまま。`test-builder` が実測のために一時的に書いた実装は完全に撤去されている
- **DB 残留 0 件**（`daily_reports` / `time_entries` / `clients` / `projects` / `tasks` すべて 0）
- **S-1〜S-3 は未適用のまま**（`clients` / `projects` / `tasks` にユニーク制約 0 本）。Round 4 のような環境汚染は再発していない

**実行環境の注記：**本コンテナに `.env` は存在せず、`DATABASE_URL` を環境変数で上書きして実行している（`AGENTS.md`「DB を分けたい場合は `DATABASE_URL` を環境変数で上書きして実行する」に従う）。上書きを忘れると `resolveDatabaseUrl` が開発用フォールバック（5432）に落ち、全 DB込みテストが接続失敗で skip される。接続先は `postgres://workhub@localhost:5433/workhub_test`。

**独立検証の結果（Round 2 完了時に更新）：**FIND-001〜003 の修正が「違反実装を実際に落とす」ことは、Phase 6 Round 2 のレーンA が独立に実測して確認した。まず正しい実装で 24 件全 PASS のベースラインを取ったうえで違反を 1 つずつ混ぜており、「元から FAIL していただけ」と区別できている。測定後の復元も `git diff` が空であることで確認済み。詳細は `findings-round2.md`。

## Phase 6 収束時点の最終値（2026-08-15・司令塔が実測）

Phase 6 は Round 5 で収束した（Critical 0・Major 0）。収束時点の数値：

| 項目 | 結果 |
|---|---|
| `npm run check-types` | **PASS** |
| `npm run test`（単体・結合内部） | **132 FAIL / 81 PASS（213 件）** |
| `npm run test:integration`（DB込み） | **56 FAIL / 19 PASS（75 件）** |
| `npm run db:push` | **`No changes detected`** |
| DB 残留 | `daily_reports` / `time_entries` / `clients` / `projects` / `tasks` すべて **0 件** |
| `git status` | **clean** |

**Red Phase 開始時（132 FAIL / 63 PASS）からの PASS 増加 +18 件はすべてテスト基盤の追加分**であり、SUT に対する新規テストの FAIL 件数 132 は一貫して変化していない：

| 追加分 | 件数 | 由来 |
|---|---|---|
| `reports.test.ts` の走査ヘルパー回帰テスト | 1 | Round 1 FIND-B09 |
| `report-db-helpers.test.ts`（`selectDeleteTargetIds`） | 7 | Round 3 FIND-R3B-01（5 件）＋ Round 4 FIND-R4-M01（2 件） |
| `assert-not-dev-database.test.ts` | 10 | Round 4 FIND-R4-M02 |

いずれも**テスト基盤自身の回帰テスト**であり、SUT に依存しないため Red Phase でも PASS するのが正しい。

**実行順序への非依存も確認済み**（レーンC が `--sequence.shuffle` 付きで全体実行し 132 FAIL / 81 PASS が通常順と完全一致）。

## 補足

- **E2E（観点表 2 章 E2E-1〜E2E-7）はコード化していない。**Phase 5 は仕様凍結までで、コード化・実行は Phase 10 の担当（フロー正典「E2E：仕様凍結とコード化の分離」）
- 観点表で対象外とした観点（1-9・2-4・2-9・3-9・4-1・4-6・4-7・4-8・4-10・5-3）はテストを書いていない
- DB込みテストは 1 ファイルが巨大になるため観点表の節ごとに 5 ファイルへ分割した（配置階層は対象モジュールと同じ `server/functions/`。`AGENTS.md` の「同じ階層に配置」は満たす）
