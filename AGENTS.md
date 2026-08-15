# AGENTS.md

work-hub（日報・工数管理システム）で作業する AI エージェント向けの指針。

## リポジトリ概要

- **構成**：npm workspaces のモノレポ（`apps/web` / `packages/shared`）
- **スタック**：TanStack Start + TanStack Router / React 19 / Tailwind CSS 4 / Vite 7 / TypeScript
- **DB**：PostgreSQL + Drizzle ORM（`apps/web/src/server/schema/`）
- **認証**：better-auth（Google OAuth）+ メールアドレス許可リスト
- **サーバー処理**：`createServerFn` によるサーバー関数（`apps/web/src/server/functions/`）。認証が必要な経路は `requireSession` ミドルウェアを通す

主要コマンド（すべてリポジトリルートから実行）：

```bash
npm run dev            # 開発サーバー
npm run db:setup       # PostgreSQL 起動 + スキーマ反映（初回）
npm run db:push        # スキーマ反映（drizzle-kit push）
npm run test           # 単体 + 結合（内部）
npm run test:coverage  # カバレッジ付き
npm run test:integration  # 結合（DB込み・要DB）
npm run test:e2e       # E2E（要DB）
npm run check-types    # 型チェック（tsc --noemit）
```

## 新規機能開発のフロー（最重要）

新規機能開発・機能追加・画面追加時は、以下の標準10フェーズフローに従うこと。

**正典：** `docs/開発プロセス/設計から実装までのフロー.md`
**本リポジトリ向けの読み替え：** `docs/開発プロセス/本リポジトリでの読み替え.md`（正典は Next.js + Prisma 前提のため必ず併読する）

```
前段. フロー設定（人間レビューの要否を決定・_flow-config.md）
1. 設計書作成 → 2. 敵対的レビュー（設計書・収束ループ） → 3. 人間レビュー（承認ゲート・スキップ不可）
→ 4. 実装計画書作成 → 5. テスト作成（Red Phase） → 6. 敵対的レビュー（テスト・収束ループ）
→ 7. 人間レビュー（承認ゲート・設定でスキップ可） → 8. 実装（Green Phase） → 9. リファクタ
→ 10. 実装検証（テスト・E2E 実行＋実装レビュー・収束ループ）
→ 実装承認ゲート（設定でスキップ可）
```

### フロー設定（機能ごとに開発開始時に決める）

機能ごとに `docs/設計/<機能名>/_flow-config.md` を作り、**人間の承認ゲートをどこに置くかを開発開始時に決める**（前段 `flow-kickoff` で作成。Phase 1 直行時は Phase 1 で作成）。以後すべてのフェーズがこの設定を読んで挙動を変える。

| ゲート | 設定 | スキップ時の代償措置 |
|---|---|---|
| 設計書承認（Phase 3） | **実施固定** | — |
| テスト承認（Phase 7） | 実施 / スキップ | Phase 5 のテスト観点を AI が全件起案（`flow-review-policy` 1.5 のチェックリスト必須）→ Adversary レビューで Critical/Major ゼロまで収束させて凍結。Phase 6 でも Major の文書化通過は不可 |
| 実装承認（Phase 10 完了時） | 実施 / スキップ | Phase 10 で Major の文書化通過は不可。戻り先が Phase 1/5 の findings は設定によらず人間へエスカレーション |

### レビューの原則（時間 vs 品質）

**レビュー時間の短縮は「較正（欠陥を能動的に探す深さ）」を下げて行ってはならない。**短縮は ①観点レーン分割による並列起動 ②報告の閾値 ③出力の粒度（Minor は1行）④差分レビュー（2周目以降）の4つで行う。過去に「批判的観点を外して時間短縮した結果、不具合を見落とした」実例がある（詳細は `flow-review-policy` skill 2章）。

**Phase 2 / 6 / 10 は収束ループ。**1回レビューして終わりではなく、**Critical / Major がゼロになるまで**「レビュー → 修正 → 差分再レビュー」を繰り返す（上限5周。超過・仕様判断が必要・承認済み成果物の変更が必要な場合は人間へエスカレーション）。

### ユーザーの発話と起動するskillの対応

| ユーザーの発話例 | 起動するskill | フェーズ |
|---|---|---|
| 「開発を始めたい」「○○機能を実装したい」（新規開発の開始合図） | `flow-kickoff` | 前段（要件受付・フロー設定） |
| 「○○画面の設計書を作って」「機能設計を書いて」 | `flow-phase1-design-doc` | Phase 1 |
| 「設計書の敵対的レビューして」「Phase 2 を実行」 | `flow-phase2-spec-review` | Phase 2 |
| 「設計書を承認します」 | （人間判断・skill不要） | Phase 3（スキップ不可） |
| 「実装計画書を作って」 | `flow-phase4-impl-plan` | Phase 4 |
| 「テストを書いて」「Red Phase に入って」 | `flow-phase5-tests` | Phase 5 |
| 「テストの敵対的レビューして」「Phase 6 を実行」 | `flow-phase6-test-review` | Phase 6 |
| 「テストを承認します」 | （人間判断・skill不要） | Phase 7（設定でスキップ可） |
| 「実装して」「Green Phase に入って」 | `flow-phase8-impl` | Phase 8 |
| 「リファクタして」 | `flow-phase9-refactor` | Phase 9 |
| 「実装を検証して」「実装をレビューして」 | `flow-phase10-impl-review` | Phase 10 |

※「実装したい」という発話でも、設計書・承認済みテストがまだ存在しない新規開発の開始合図は `flow-kickoff` が受ける（`flow-phase8-impl` は Phase 7 承認済みテストが前提）。

### 運用上の重要ルール

1. **各skillの完了時、必ず「次フェーズ案内」を出力すること** — ユーザーが次に何をすべきか迷わないように
2. **前提フェーズの完了確認** — フローの途中フェーズが直接呼ばれた場合、前のフェーズが完了しているか確認してから実行する
3. **単発利用の判定** — 既存機能の小修正など、フル10フェーズが過剰な場合は「単発利用」としてそのフェーズだけ実行する。最初にユーザーに確認する
4. **レビューとワーカー作業は fresh context で起動** — Phase 2/6 の敵対的レビュー（`adversarial-reviewer`）、Phase 10 の実装レビュー（`impl-reviewer`）、Phase 5 のテスト作成（`test-builder`）・Phase 8 の実装（`impl-builder`）は、司令塔（メイン会話のAI）と分離された fresh context のサブエージェントとして起動する。同一会話で実施しない。各役割の定義は `.claude/skills/flow-agent-roles/roles/` 配下の役割ファイルが正本であり、起動時にサブエージェントへ最初に読み込ませる
5. **レビューは観点レーンごとに並列起動する** — Phase 2/6/10 のレビューは観点を3レーンに分け、レーンごとに別のサブエージェントを**同一メッセージ内でまとめて起動**して並列に走らせる。各レーンの findings は司令塔がマージする（要約・軟化・削除は禁止）
6. **収束するまで回す** — Phase 2/6/10 は Critical/Major がゼロになるまでループする。修正はそれぞれ司令塔（設計書）・`test-builder`（テスト）・`impl-builder`（実装）が担当し、司令塔がテスト・実装コードを直接書くことはない

### lean運用（プロトタイプ・MVP検証）

- Phase 4（実装計画書）は省略可
- Phase 9（リファクタ）は明らかに不要なら省略可
- レビュー findings の Minor は文書化のみで通過可
- **Major の「対応方針を文書化して通過」は、該当する人間ゲートが「実施」で、人間が明示的に判断した場合のみ可**（AI が自分の判断で通過させることは禁止。ゲートをスキップした機能では使用不可）
- Critical は常に修正必須（Severity 判定基準はフロー正典参照）

省略不可フェーズ：Phase 2（設計書レビュー）、Phase 5（テスト・Red Phase 証拠）、Phase 6（テストレビュー）、Phase 8（実装・Green Phase 証拠）、Phase 10（実装検証：テスト・E2E 実行＋実装レビュー）。**収束ループも省略不可。**

## テスト指針

### テストフレームワーク

- **Vitest**（単体テスト・結合テスト）／**Playwright**（E2Eテスト）
- 設定ファイルは `apps/web/` 配下（`vitest.config.ts` / `vitest.integration.config.ts` / `playwright.config.ts`）

### 実装ワークフロー（テスト先行）

```
1. 仕様を明確にする（設計書・チケットの要件を整理）
2. AIにテストを書かせる（仕様に基づく失敗するテスト）
3. 人間がテストを確認する（仕様を正しく表現しているか）
4. AIに実装させる（テストを通す実装）
5. CIで自動チェック（型チェック + 全テスト）
6. 必要に応じて人間がレビュー
```

- テストは実装より先に書く。実装コードに合わせてテストを書かない
- 既存コードの変更時も同じワークフローを適用する（変更後の期待動作をテストで先に書く）

### テストファイルの配置

**対象モジュールと同じ階層に配置する。**`__tests__/` ディレクトリは作らない（既存の慣習に合わせる）。

| 種別 | ファイル名 | 例 |
|---|---|---|
| 単体・結合（内部） | `<対象>.test.ts` | `src/lib/time-utils.test.ts` |
| 結合（DB込み） | `<対象>.integration.test.ts` | `src/server/auth/auth.integration.test.ts` |
| E2E | `apps/web/e2e/<機能>.test.ts` | `e2e/daily-report.test.ts` |

### テスト作成のルール

- `beforeEach` で `vi.clearAllMocks()` を実行し、テスト間の副作用を排除する
- 外部依存（DBクライアント・外部API等）は `vi.mock()` でモック化する
- テスト間の依存を作らない（実行順序に依存しない設計）
- セキュリティ要件のテストは人間が設計する
- **Red Phase 証拠はスタブ最小実装方式で取る**：Phase 5 でテスト対象関数のスタブ（シグネチャ＋固定ダミー返却のみ・実ロジック禁止）を併せて作成し、新規テストは import エラーではなく**期待値不一致で個別に FAIL** させる。スタブ段階で PASS するテストはトートロジー疑いとして書き直す

### DB込み結合テストの注意（重要）

**全テーブル TRUNCATE を既定の手段にしない。**本リポジトリは `.env` 一本で環境変数を解決しており（`apps/web/src/server/env.ts`）、テストが開発用 DB に接続する運用のため、全件削除は開発中の日報データを消す。

- テストが作成したデータだけを、対象を絞って削除する（例: `apps/web/src/server/auth/auth.integration.test.ts`）
- 対象テーブルを空にする必要がある場合のみ、`apps/web/src/test/db-helpers.ts` の `truncateTables()` にテーブル名を明示列挙して呼ぶ
- DB を分けたい場合は `DATABASE_URL` を環境変数で上書きして実行する
- **結合テスト（DB込み）を新規追加する際は `apps/web/src/test/report-db-helpers.ts` を経由すること。**開発 DB への誤接続を拒否するガードB（DB 名判定）は `vitest.integration.config.ts` の `setupFiles` で全 `*.integration.test.ts` に機構で強制されるが、書き込み前の非空チェック（ガードA）はファイル単位のスナップショットが前提のため `setupFiles` には無く、`report-db-helpers.ts` を import した場合にのみ効く（Phase 6 Round 3 FIND-LC-M01 の代償措置）。ヘルパーを経由しない新規結合テストはガードAの保護を受けない

### テスト対象の判断基準

| 対象 | テストを書く | テスト種別 |
|------|------------|-----------|
| サーバー関数（`createServerFn`） | はい | 結合テスト（内部）`*.test.ts` |
| ビジネスロジック・変換処理 | はい | 単体テスト `*.test.ts` |
| ユーティリティ関数（純粋関数） | はい | 単体テスト `*.test.ts` |
| バグ時の影響が大きい処理（認証、データ削除等） | はい | 単体テスト `*.test.ts` |
| 条件分岐が3つ以上ある処理 | はい | 単体テスト `*.test.ts` |
| DB制約・実JOIN・トランザクション検証 | はい | 結合テスト（DB込み）`*.integration.test.ts` |
| クリティカルパス（ログイン・画面遷移等） | はい | E2Eテスト `e2e/*.test.ts` |
| 表示系コンポーネント | いいえ | （ロジックを分離してそちらをテスト） |
| スナップショットテスト | いいえ | （保守コストが高い） |

### テスト種別ごとの実行コマンド

| テスト種別 | コマンド | DB必要 | 備考 |
|---|---|---|---|
| 単体 + 結合（内部） | `npm run test` | 不要 | CI（`ci.yml`）で自動実行 |
| 結合（DB込み） | `npm run test:integration` | 必要 | CI（`ci.yml`）で PostgreSQL サービスを立てて実行 |
| E2E | `npm run test:e2e` | 必要 | CI（`playwright.yml`）で自動実行 |

### lint について

**本リポジトリには linter が導入されていない。**フロー正典・Phase 10 の実行検証に登場する `npm run lint` は「該当なし」として扱い、`npm run check-types` を代替の静的チェックとする。

### 詳細ドキュメント

- `docs/開発プロセス/本リポジトリでの読み替え.md` — 正典を本リポジトリ向けに読み替える対応表
- `docs/開発プロセス/テストレベル選定トリガー表.md` — テストレベルの選定基準
- `docs/開発プロセス/テスト観点表テンプレート.md` — 影響度トリガー該当時のテスト仕様確定様式
- `flow-review-policy` skill — レビュー方針の正本（フロー設定・較正不変の原則・観点レーン分割・must-catch・収束ループ）
