# テスト 敵対的レビュー結果（Phase 6 Round 5・上限周回）

- **対象コミット**：`c6e21d0`（Round 4 の Major 1・Minor 3 の修正）／比較元 `6e475f0`
- **レビュー日時**：2026-08-15
- **方式**：2 レーン構成（レーンC が DB を占有、レーンA+B 統合は DB 不使用）。観点は 6 つとも維持
- **総合判定**：**PASS**（Critical 0・Major 0・Minor 1）

## **Phase 6 の収束を宣言する**

`flow-review-policy` 4.2 の収束条件（**Critical 0・Major 0**）を Round 5 で満たした。**人間へのエスカレーションは不要**（上限 5 周に到達したが、到達時点で収束している）。

| Round | Critical | Major | 備考 |
|---|---|---|---|
| 1 | 0 | 6 | |
| 2 | 1 | 2 | 凍結済み観点表の変更が必要 → 人間判断（規定 3・規定 5 を改訂） |
| 3 | 1 | 2 | 凍結済み観点表の変更が必要 → 人間判断（規定 10 を新設） |
| 4 | **0** | 1 | Critical が初めてゼロに |
| 5 | **0** | **0** | **収束** |

Round 2〜3 は「修正が新しい欠陥を生む」振動の様相を呈したが、Round 4 以降は Critical→0、Major→1→0 と単調に減少しており、`flow-review-policy` 4.3-4 が定義する振動ではなく収束と判定する。

## Round 4 findings の解消状況

| Round 4 の finding | 判定 | 裏付け |
|---|---|---|
| FIND-R4-M02（Major・`resolveEffectiveDbName` に自動テストが無い） | **解消** | レーンA+B が違反実装 4 種を注入して実測（fallback 順序の破壊 → 1 件 FAIL／fail-open への退行 → 1 件 FAIL／先頭スラッシュ除去忘れ → 4 件 FAIL／`password` を拾う → 3 件 FAIL）。復元も `git diff` 空で確認 |
| FIND-R4-M03（Minor・`deleteNewRows` の検出力空洞） | **解消** | レーンC が実測。5-4 / 5-6 の固定名（`(名称未設定)` / `123` / `[object Object]` / `456 / IT0506-タスク`）で計 9 行を**保存前から存在する状態**で投入 → フル実行 → **id・全カラムとも byte-for-byte 不変** |
| FIND-R4-M01（Minor・テストベクタが弱い） | **解消** | 双方向・単方向の部分文字列一致実装がいずれも FAIL することを実測 |
| FIND-R4-LC-M02（Minor・メッセージの参照ずれ） | **解消** | grep で旧プレフィックスの残存ゼロ |

## Minor（新規 1 件）

### FIND-R5-M01: `decodeURIComponent(parsed.username)` を除去する退行が新規 10 件を全件通過する

- **観点 / レーン**：MC-1（能動的な穴探し）／レーンA+B
- **重大度**：**Minor**
- **ファイル**：`apps/web/src/test/assert-not-dev-database.ts:65`
- **問題**：postgres-js の `parseUrl` は `username: decodeURIComponent(urlObj.username)` と明記しており、このデコードは実挙動の再現に必須。しかし新規 10 件のテストは非エンコードの username（`workhub` / `someuser`）しか使っておらず、**デコードの有無を判別する入力が 1 件も無い**（レーンA+B が実測。除去しても 10 件全 PASS）
- **理論上の実害**：デコードが失われた状態で `postgres://work%68ub@host:5432` のような接続文字列を使うと、postgres-js は `workhub`（開発 DB）へ接続する一方、ガードBは `work%68ub !== workhub` で**素通しする**
- **Minor と判定した根拠**：**現行コードにはデコードがあるため実害はゼロ**であり、指摘の実体は検出力の空洞のみ。`.env.example` / `docker-compose.yml` / `ci.yml` の 3 箇所とも非エンコードの username であり到達しない。Round 4 の FIND-R4-LC-M01（同種の「ガードB周辺で自動テストが担保しきれていない箇所」）と同一の判断基準を適用した
- **司令塔の推奨**：**閉じるのは percent-encoded username のケースを 1 件足すだけである。**前回 Critical（FIND-LC-C01）の心臓部に残る最後の既知の穴であり、安価に塞げる。ただし Round 5 は上限周回であり、`AGENTS.md` の lean 運用（「Minor は文書化のみで通過可」）にも適合するため、**対応要否を Phase 7 の人間判断に委ねる**

## レーンC が PASS と判定した項目（実測の裏付け）

| 検証 | 実測 |
|---|---|
| `Array.includes` → `Set.has` の等価性 | 呼び出し元 3 経路とも `uuid` 列由来の `string[]`。NaN・数値・undefined の混入経路なし |
| 規定 4（固定名防御）の実 DB 保護 | 固定名 9 行を保存前から存在する状態で投入 → フル実行 → **byte-for-byte 不変**。後始末後 DB 全テーブル 0 件 |
| `vi.mock` の漏洩 | `assert-not-dev-database.test.ts` と `env.test.ts`（実モジュール使用）を同時・単独・全体実行のいずれでも結果不変。**漏洩なし** |
| `PGDATABASE` の汚染 | `npm run test` 全体実行後も他ファイルへの影響なし（`env.test.ts` 10/10 PASS 継続）。`hasOwnProperty` 方式の復元が機能 |
| テスト実行順序への非依存 | `--sequence.shuffle` 付き全体実行で **132 FAIL / 81 PASS（213）** ― 通常順と完全一致 |
| ガードA（差分後） | `2026-03-02` に模擬データ → 5 ファイル即時中断 → **id・note・raw_data 完全不変** |
| ガードB（ヘルパー未 import） | `auth.integration.test.ts` を dev DB 名で単独実行 → `setupFiles` 経由で拒否・**exit code 1** |
| GUARD_DATES の動的網羅 | **positive control 付き**でトリガーを設置（範囲外日付 `1999-01-01` が確実に検知されることを先に確認）→ フル実行 → **違反 0 件** |
| `requireSession` の退行検出 | 3 変異とも**狙った 1 テストのみ**が新規 FAIL、他 14 件は無変化 |
| Red Phase 証拠 | import エラー 0 件、スタブ 2 ファイルに実ロジック混入なし、S-1〜S-3 未適用、`check-types` PASS、`db:push` = `No changes detected`、DB 残留 0・advisory lock 0・tmp 制約 0 |

**レーンC が positive control を先に取ってから本測定を行った点を評価する。**「違反 0 件」という結果は、検知機構そのものが動いていない場合にも出る。それを排除したうえでの 0 件である。

## 司令塔による最終検算（2026-08-15）

| 項目 | 結果 |
|---|---|
| `npm run check-types` | PASS |
| `npm run test` | **132 FAIL / 81 PASS（213）** |
| `npm run test:integration` | **56 FAIL / 19 PASS（75）** |
| `npm run db:push` | `No changes detected` |
| DB 残留 | `daily_reports` / `time_entries` / `clients` / `projects` / `tasks` すべて 0 件 |
| `git status` | clean |

---

# Phase 7（人間によるテスト承認ゲート）への申し送り

両レーンが挙げた事項を司令塔が統合した。**人間が明示的に確認・承認すべき事項**である。

## A. 「自動テストで担保しない」と決めた事項（承認の追認が必要）

| 項目 | 状態 | 確認してほしいこと |
|---|---|---|
| **AC-62**（マスタ解決の順序） | **無検証。**検証手段が 3 周（単体 → 結合内部 → 機能的固定）にわたり成立せず、2026-08-15 に人間判断で無検証と決定 | この判断自体の追認。順序規定は設計書に残り Phase 10 の実装レビューで目視確認する運用でよいか |
| **AC-64**（再 SELECT 0 件の終端条件） | **無検証。**READ COMMITTED では到達経路を決定的に構成できない | 将来分離レベルを変更する場合は再判定が必要である旨の了解 |
| **5-3**（境界値のうち上限件数） | チェックリスト項目を意図的に落とす判断 | 再確認 |
| **E2E-5（AC-65）の残余** | `T2 < T1 + 2000` が AC-65 本来の `T2 < t0 + 2000` より δ=`T1 - t0` だけ緩い。**3 周（R1-M15 → R3-M9 → R4-M7）持ち越しの末に「解消していない」と明記のまま凍結** | E2E は Phase 10 でコード化する。その際にこの緩さを埋めるか、明示的に受容するかの判断 |

## B. 今回のレビューで残した Minor（対応要否の判断）

| 項目 | 内容 | 司令塔の推奨 |
|---|---|---|
| **FIND-R5-M01** | `decodeURIComponent` 除去の退行を新規 10 件が検出できない | **閉じることを推奨**（percent-encoded username のケースを 1 件追加するだけ） |
| **FIND-R4-LC-M01** | `resolveEffectiveDbName` が postgres-js の `PGUSERNAME` / `PGUSER` / OS ユーザー名フォールバックを実装せず fail-closed で短絡 | **修正しない。**実装すると現在拒否しているケースが通過するようになり**ガードが緩む**ため。ただし将来 `.env.example` / `docker-compose.yml` / CI の接続文字列からユーザー名が失われる変更があると、ガードBが無条件 fail-closed になり**結合テストが起動不能になる**副作用がある（運用変更時は `assert-not-dev-database.ts:38-46` のコメントを読み返すこと） |
| その他の Minor | Round 1〜4 の Minor 計 15 件程度。`AGENTS.md` の lean 運用により文書化のみで通過 | 各 findings ファイルに記録済み |

## C. Phase 8（実装）実施後に**必ず再検証が必要**な事項

現行（Phase 8 前）の `saveReportFn` / `deleteReportFn` は `daily_reports` にしか書き込まないため、**次の経路は今回のレビューで実質未運動である**：

1. **GUARD_DATES の動的網羅を `time_entries` / `clients` / `projects` / `tasks` の全経路で再実測すること。**今回の観測（66〜69 日付・違反 0 件）は `daily_reports` のみで成立している
2. **ガードA の非空チェックを `time_entries` について再実測すること。**Phase 8 で T-1 の洗い替え（AC-08・AC-09）が実装されると、`time_entries` も UPSERT 型の破壊対象に加わる
3. **`cleanupFixedNames` の新旧混在削除の実 DB 経路**（純粋関数の単体テスト 7 件では担保済みだが実 DB 経路は未運動）

## D. Phase 7 の承認対象の範囲（誤解を避けるため）

- **承認対象はテストが表現する「仕様の意図」であり、「実装の配置の確定」ではない。**`report-normalize.ts` の関数名・配置（8 シンボル）と `saved-msg.ts` の reducer 名は **Phase 5 が発明した仮置き**である。設計書が場所を規定しているのは `src/lib/` への reducer 切り出しのみで、Phase 8 で配置が変わる可能性がある（変える場合はテスト側の import 修正が要る）
- **E2E（2 章 E2E-1〜E2E-7）は仕様凍結のみでコード化していない。**コード化・実行は Phase 10 の担当
- **スタブ段階で PASS する 19 件**（`red-phase-evidence.md` に分類を記載）は、Round 1〜5 を通じて個別にトートロジー疑いを検証済み。Phase 7 では「この分類がトートロジーでないことの説明として十分か」という観点で確認することを推奨。**なお Round 1 のレーンA が指摘したとおり、この 19 件のリストだけを見ても到達できない欺瞞性が存在しうる**（実際、リストに無い `saved-msg.test.ts` に最も重いトートロジーが残っていた）

## E. 本機能で構造的に非該当と判定した観点

- **MC-2（PII 3 層検証）・MC-3（認可 2 層検証）は本機能では非該当。**スキーマ 3 ファイルを全読みし、`tasks` / `clients` / `projects` / `time_entries` / `daily_reports` のいずれにも `user_id` / `company_id` が存在しないことをレーンC が確認済み。**将来、他ユーザーのデータを扱う機能に拡張される場合は改めて起案が必要**
- **E2E-6（未認証 401 判定・AC-40 / AC-75）が本機能で唯一の認可境界検証**であり、Phase 10 でのコード化が必須。実行漏れがないよう明示的にフォローすること
