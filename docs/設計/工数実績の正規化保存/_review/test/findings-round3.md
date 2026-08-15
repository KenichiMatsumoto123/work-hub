# テスト 敵対的レビュー結果（Phase 6 Round 3・差分レビュー）

- **対象コミット**：`bfc7a76`（Round 2 の Critical 1・Major 2 の修正）／比較元 `0d71b14`
- **レビュー日時**：2026-08-15
- **方式**：観点レーン分割。**Round 2 で 2 レーンが同一 DB に並行アクセスして相互汚染が起きたため、DB を使うレーンは直列化する方針に変更。**レーンA（欺瞞性・実装詳細の過剰束縛）を DB 不使用の条件で先行実施
- **進行状況**：**レーンA のみ完了。レーンB（仕様対応）・レーンC（セキュリティと証拠）は未実施**
- **総合判定**：**FAIL**（Critical 1・Major 0・Minor 3）— レーンA の時点で人間判断が必要な Critical が確定したため、いったん中断してエスカレーションする

## レーンA が PASS と判定した項目（裏付け）

| 項目 | 判定 | 裏付け |
|---|---|---|
| `beforeAll` の実行順序（FIND-C01 の防御の前提） | **PASS** | レーンA が**リポジトリ外に最小 Vitest プロジェクトを作って実測**。「ヘルパーモジュールの `beforeAll` → テストファイル自身の root `beforeAll` → テスト → ネスト `describe` の `beforeAll`」の順であることを確認。`isolate: true` によりファイルごとにモジュールが再読込されることも実測 |
| 同一ファイル内の後続 describe が作る行の誤認 | **PASS** | 新規行の id は UUID であり、ファイル開始前の id 集合と衝突しないため論理的に不可能 |
| FIND-B10・FIND-B11 のトートロジー | **PASS** | before/after は自己参照比較ではなく**両方とも固定の `expectedSeedState` と比較**している。seed が失敗すれば `before` が期待値と不一致で FAIL する |
| `0050-03-01` の重複による相互干渉 | **PASS** | `afterEach` の `cleanup` が各テスト直後に走り、id ベース削除で新規行は確実に回収される |
| Round 2 の PASS 項目の維持 | **PASS** | 差分は 2 ファイルのみ。スタブ 2 ファイルは対象外。`npm run test` は 132 FAIL / 64 PASS で退行なし |

## Critical

### FIND-R3-C01: `saveReportFn` の UPSERT が FIND-C01 の防御をすり抜け、利用者の日報を**痕跡なく上書き破壊**する

- **観点 / レーン**：(A)+(C) の交差／MC-2・MC-5（実データ保護）／レーンA が論証 → **司令塔が実測で確認**
- **重大度**：**Critical**
- **ファイル**：
  - `apps/web/src/server/functions/reports.ts:63-100`（`saveReportFn` の `onConflictDoUpdate`）
  - `apps/web/src/server/schema/reports.ts`（`date` の unique 制約）
  - `apps/web/src/server/functions/reports-common.integration.test.ts:519-527`（`ROLLOVER_SEED_DATES`）・`:565-571`（seed）・`:617-623`（FIND-B10 の seed）
  - `apps/web/src/test/report-db-helpers.ts:118-149`（`deleteByDates` の防御。**この防御の射程外であることが問題**）
- **問題**：`saveReportFn` は `daily_reports.date`（unique）に対して `.onConflictDoUpdate` を使う真の UPSERT である。衝突時は**既存行を同じ id のまま内容だけ更新する**（delete + insert ではない）。

  一方 FIND-C01 の防御は「保存前スナップショットに無い id の行だけを削除する」という **DELETE 経路のみ**の機構であり、UPDATE 経路には一切関与しない。既存行の id はスナップショットに含まれるため `deleteByDates` は正しく「削除しない」と判定するが、**削除しないことは中身を守ることを意味しない。**

- **司令塔による実測（2026-08-15）**：`2026-03-02` に利用者の日報を模した 1 行を投入し、`npm run test:integration` をフル実行した。

  | | 実行前 | 実行後 |
  |---|---|---|
  | `id` | `bbbbbbbb-…-000000000001` | `bbbbbbbb-…-000000000001`（**同一**） |
  | `note` | `利用者が書いた所感` | **`NULL`** |
  | `raw_data` | `{"mine": true}` | `{"date": "2026-03-02", "note": "", "endTime": "18:00", …}`（テストの捏造データ） |

  **行は残り、id も変わらず、中身だけが破壊された。**削除と違って痕跡が残らないため、開発者が異変に気づきにくい分より悪質である。

- **RESID-01 の評価が不完全だった理由**：司令塔は「Phase 8 で AC-73 の日付検証が入れば自然に解消する」と評価したが、これは**不正な形式の入力を弾く話**であり、本欠陥は**正当な（整形式の）日付に対する正規の `saveReport` 呼び出し**が引き起こす。AC-73 / AC-74 がどれだけ正しく実装されても解消しない。

  さらに Phase 8 で T-1 の「同日付の実績を洗い替える」（AC-08・AC-09）が実装されると、**現在は無傷の `time_entries` も同種の上書き破壊の対象に拡大する**。つまり Phase 8 は本欠陥を解消せず、対象を広げる。

- **本ラウンドの差分がリスクを拡大させた事実**：FIND-B11 の修正（人間承認のうえ司令塔が指定）は `ROLLOVER_SEED_DATES` に **`2026-03-01` / `2026-03-02`** を新規追加した。本日は 2026-08-15 であり、これらは**約 5 か月半前＝実利用期間内の現実的な日付**である。`findings-round2.md` の「影響範囲の実測（司令塔）」が述べた「後始末対象は年 0004 / 0050 / 2000 / 2028 のみ」という前提は、**この差分によって崩れている**。司令塔はこの帰結を予見せずに追記を推奨した
- **影響**：`AGENTS.md`「全テーブル TRUNCATE を既定の手段にしない…全件削除は開発中の日報データを消す」が守ろうとしている利益を、DELETE とは別経路（サイレントな内容上書き）で侵害する
- **推奨対応（レーンA 提示・司令塔が支持）**：
  1. **案A（推奨）：書き込み前ガード。**`report-db-helpers.ts` の `capturePreWriteSnapshot` の直後に、そのファイルが使う全日付について `daily_reports` / `time_entries` に既存行がゼロ件であることを確認し、1 件でもあれば `throw` してテスト実行全体を中断する。**検出力を一切落とさずに上書き・削除の両経路を未然に防ぐ。**ヘルパー内で完結し実装コストが低い
  2. **案B：専用 DB の強制。**`resolveDatabaseUrl()` が返す接続先が開発用 DB のときは結合テストの起動を拒否する（`AGENTS.md` が既に推奨する運用を機構で強制する）
  3. 案A・案B は併用可能
- **戻り先**：**人間（Phase 7）へエスカレーション。**凍結済み観点表のさらなる改訂が必要であり、かつ「上書きリスクをどこまで受容するか」は仕様判断（`flow-review-policy` 4.3-1・4.3-2）

## Minor（1行）

- FIND-R3-M01：観点表 規定 3 の文言「対象日付の id を採取」と実装（全行 SELECT）が不一致。安全側への乖離であり機能上のバグではない
- FIND-R3-M02：`preWriteSnapshot === null` のフォールバック分岐は、Vitest の `beforeAll` 失敗時セマンティクスとファイル単位のモジュール分離を踏まえると通常運用では到達しにくく、コメントが想定するほどの安全網ではない
- FIND-R3-M03：スナップショット取得後・削除実行前に、テストとは無関係な**実利用者の新規保存**が同じ日付に発生すると、その正規の行がテスト由来と誤認されて削除されうる（1 点スナップショットのため）

---

# Round 3 後半（規定 10 の二重ガード実装後・レーンB / レーンC）

- **対象コミット**：`f436f78`（規定 10 の二重ガード実装）
- **方式**：レーンC が DB を占有し、レーンB は DB 不使用の条件で並行実行（Round 2 の相互汚染を受けた方針変更）
- **判定**：**FAIL**（Critical 1・Major 2・Minor 6）

## AC 対応マトリクス（レーンB・更新後）

| 区分 | Round 2 | Round 3 |
|---|---|---|
| ✅ | 74 | **76** |
| ⚠️ | 2（AC-73・AC-74） | **0** |
| ❌ | 0 | 0 |
| N/A | 8 | 8 |

**FIND-B10・FIND-B11 は解消。**AC-74 が名指しする `2026-02-30` → `2026-03-02` の経路について、違反実装がメッセージだけ正しく整えても `after` の DB 状態が期待値と不一致になり FAIL する構造であることをレーンB が論証した。

## Critical

### FIND-LC-C01: ガードB の DB 名判定が、パス省略・末尾スラッシュのみの接続文字列で無効化される

- **観点 / レーン**：⑤ セキュリティ・品質観点（MC-2・MC-5）／レーンC が発見 → **司令塔が実測で確認**
- **重大度**：**Critical**
- **ファイル**：`apps/web/src/test/report-db-helpers.ts:40-60`（`assertNotDevDatabase`）
- **問題**：`assertNotDevDatabase` は `new URL(url).pathname.replace(/^\//, '')` で DB 名を取り、`'workhub'` と厳密一致で判定する。しかし postgres-js の DB 名解決は別のフォールバック連鎖を持つ：

  ```js
  database: o.database || o.db || (url.pathname || '').slice(1) || env.PGDATABASE || user
  ```

  `DATABASE_URL` に**パス部（`/dbname`）が無い、または末尾スラッシュだけ**の場合、`pathname` は空文字になり、postgres-js は `PGDATABASE` 未設定なら**接続ユーザー名と同名の DB（`workhub`）へ接続する**。一方ガードBは `dbName === ''` となり `'workhub' !== ''` のため**素通しする。**

- **司令塔による実測（2026-08-15）**：

  | `DATABASE_URL` | `pathname` | ガードB発火 |
  |---|---|---|
  | `postgres://workhub:workhub_dev@localhost:5432` | `""` | **false（素通し）** |
  | `postgres://workhub:workhub_dev@localhost:5432/` | `""` | **false（素通し）** |
  | `postgres://workhub:workhub_dev@localhost:5432/workhub` | `"workhub"` | true |

  さらに実際の postgres-js で `postgres('postgres://workhub:workhub_dev@localhost:5433')` を接続したところ、エラーは **`database "workhub" does not exist`（SQLSTATE 3D000）**。**接続先として実際に `workhub` を試みている**ことを確認した。本コンテナには `workhub` DB が無いため失敗するが、docker-compose で `workhub` を立てている開発者のマシンでは**そのまま接続が成立する**。

- **影響**：規定 10 は「ガードA が対象外とする日付・将来の GUARD_DATES 記載漏れに対しても独立に止まる」ことを狙って A・B を併用する設計だった。本バグにより「`DATABASE_URL` の末尾に `/dbname` を書き忘れる」という**起こりやすい入力ミス 1 つで二重ガードが単一ガードに縮退する**
- **推奨対応**：DB 名の抽出を postgres-js のフォールバック連鎖（`pathname → PGDATABASE → user`）に合わせて再実装する。あわせて「解析不能ならチェックしない」という現状の fail-open な設計も fail-closed に改める
- **戻り先**：Phase 5（`test-builder`）。**規定 10 のロジック実装上のバグであり、規定 10 自体の再改訂や仕様判断を要さないため人間ゲートへの再エスカレーションは不要**

## Major

### FIND-R3B-01: ガードA が規定 3（FIND-C01 の防御）を実質的に検証不能にしている

- **観点 / レーン**：③④ の交差（司令塔が指定した MC-1 の論点）／レーンB
- **重大度**：Major
- **ファイル**：`apps/web/src/test/report-db-helpers.ts`（`beforeAll` の発火順序・`deleteByDates` の id フィルタ）
- **問題**：ガードA は全対象日付が空であることを保証してからテストを実行する。したがって**ガードA が通過した実行では対象日の `preWriteSnapshot` は構造的に必ず空集合**になり、`!timeEntryIds.has(id)` は常に真＝全件削除と等価になる。FIND-C01 で入れた「保存前から存在した行は削除しない」分岐は**どのテスト実行でも到達しない**
- **影響**：実データ保護自体はガードA/B の多重防御で守られているが、**多重防御の一角（規定 3）が正しく機能し続けているかを検証する自動テストが存在しない。**将来この分岐が無条件 `DELETE WHERE date IN (...)` に静かに退行しても、どのテストも落ちない（検出力の空洞化）
- **推奨対応**：id フィルタのロジックを純粋関数に切り出し、スナップショットを注入する単体テスト（`npm run test` レベル・DB 不要）を追加する。**凍結済み成果物の変更は不要**（Round 1 で `hasRequireSessionMiddleware` の回帰テストを観点表の変更なしに追加した前例と同じ扱い）
- **戻り先**：Phase 5（`test-builder`）

### FIND-LC-M01: ガードの保護範囲が `import` に依存しており、将来の書き込み経路を構造的に強制できない

- **観点 / レーン**：⑤（MC-5）／レーンC
- **重大度**：Major
- **ファイル**：`apps/web/vitest.integration.config.ts`（`setupFiles` 未設定）／`apps/web/src/test/report-db-helpers.ts`
- **問題**：ガードA・B はいずれも `report-db-helpers.ts` を **import した場合にのみ**発動する。`vitest.integration.config.ts` に `setupFiles` が無く、**プロジェクト全体へ強制する仕組みが無い**。現状 5 ファイルすべてが import しているため実害は無いが、将来ヘルパーを経由せず `../db` と `../functions/reports` を直接 import する結合テストが足されると、**GUARD_DATES 内の日付であってもガードが一切発動しない**
- **影響**：規定 10 が「機構で強制する」ことを目的にしているのに対し、実装は「規約としてヘルパーを使うことを期待する」形にとどまっている
- **推奨対応**：ガードB（データ状態に依存せず判定できる）を `vitest.integration.config.ts` の `setupFiles` へ移し、`*.integration.test.ts` 全ファイルに無条件適用する。ガードA はファイル単位スナップショットが前提のため設計変更を要するので、本ラウンドでは代償措置（`AGENTS.md` への注意書き）でよい
- **戻り先**：Phase 5（`test-builder`）

## レーンC が PASS と判定した項目（実測の裏付け）

| 検証 | 実測 |
|---|---|
| ガードB の他形式による迂回 | 大文字化 `/WORKHUB`・`?options=`・UNIX ソケット形 `postgres:///workhub?host=...` を実測。**追加の迂回経路は発見されず**（pathname は正しく取れる） |
| `auth.integration.test.ts` がガードB対象外である実害 | **実害なし。**`daily_reports` / `time_entries` に一切触れず、`TEST_EMAILS` に基づく id 絞り込み削除を独自実装済み |
| GUARD_DATES の**動的**網羅チェック | `daily_reports` / `time_entries` に AFTER INSERT/UPDATE トリガーを仕込んでフル実行し、実際に書き込まれた日付を収集。**観測 66 日付・GUARD_DATES 外への書き込みゼロ** |
| ガードA throw 時の後始末漏れ | throw はスナップショット直後・書き込み前に起きるため**新規残留なし**。行は id/date/note/raw_data すべて不変。5 ファイルすべてが独立にガードを効かせることも確認 |
| CI の偽陽性 | `ci.yml` の `workhub_test` は判定に一致せず通過。CI は毎回空 DB スタート。**偽陽性なし** |
| 非 GUARD_DATES 日付での既存データ無傷 | `2050-06-15` に接頭辞なしの 5 行を投入してフル実行 → **id・内容とも完全一致・新規残留なし** |
| `requireSession` の退行検出 | worktree に 3 変異を注入。**3 変異とも狙った関数のテストだけが FAIL**、他は PASS |
| Red Phase 証拠の検算 | 単体 132 FAIL / 64 PASS（196）、結合 56 FAIL / 19 PASS（75）、`db:push` = `No changes detected`、import エラー 0 件、スタブ 2 ファイルに実ロジック混入なし（`AUTO_CLEAR_MS = 2000`）、S-1〜S-3 未適用、実行後の残留 0 件・advisory lock 0 件 |

## Minor（1行）

- FIND-R3-M01 / FIND-LC-M02：規定 3 の文言「対象日付の id を採取」と実装（全行 SELECT）の不一致。安全側への乖離
- FIND-R3-M02 / FIND-LC-M03：`preWriteSnapshot === null` フォールバック分岐は通常運用では到達しにくく、安全網としての実効性が低い
- FIND-R3-M03 / FIND-LC-M04：スナップショット取得後・削除前の TOCTOU で実利用者の新規保存を誤削除しうるレース。ガードA（開始時点のみのチェック）でも解消していない
- FIND-R3B-M01：5-10 の ROLLOVER 系テストは `time_entries` 由来の値しか before/after 判定しておらず、`daily_reports` の `note` / `raw_data` の内容破壊は同テストでは検出できない
- FIND-LC-M05：GUARD_DATES の動的網羅チェックは `daily_reports` のみで成立。`time_entries` は Phase 8 未実装で書き込みが 0 件のため未検証。**Phase 8 の T-1 実装後に同じ手法（トリガーによる動的観測）で再検証すること**
- FIND-R3B-M02：Round 3 前半の Minor は未修正のまま残置（担当外）

## 収束判定（Round 3）

**未収束（Critical 1・Major 2）。**Round 3 / 上限 5 周。

**3 件とも凍結済み成果物の変更を要さない**ため、人間ゲートへの再エスカレーションは不要と判断する（FIND-LC-C01 は規定 10 の実装バグ、FIND-R3B-01 と FIND-LC-M01 はテスト・設定の追加）。`test-builder` に修正させて Round 4 の差分レビューへ進む。
