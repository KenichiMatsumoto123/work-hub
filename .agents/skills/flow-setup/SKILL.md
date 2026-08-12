---
name: flow-setup
description: "AI駆動開発10フェーズフローの導入セットアップ。対象リポジトリへのプロセスドキュメント設置・AGENTS.md（CLAUDE.md）へのフロー節追記・テスト基盤（Vitest/Playwright/CI）の構築・導入検証を行う。リポジトリごとに1回だけ実行する（10フェーズフローのフェーズではない）。使用トリガー: 「開発フローを導入して」「flow-setup を実行」「このリポジトリにAI駆動開発フローをセットアップして」等。"
---

# flow-setup: 開発フロー導入セットアップ

AI駆動開発10フェーズフロー（flow-phase 系 skill）を新しいリポジトリで使えるようにする導入 skill。skill 群自体の配布（skills CLI 等）では届かない資産——プロセスドキュメント・AGENTS.md のフロー節・テスト基盤——を、本 skill 同梱の `templates/` から対象リポジトリへ設置する。

**実行単位：** リポジトリごとに1回。機能開発のたびに実行するものではない。

**前提スタック：** テンプレートは Next.js（App Router）+ TypeScript + Prisma + Vitest + Playwright + GitHub Actions を前提とする。異なるスタックの場合は Step 0 で調整箇所を洗い出し、人間の確認を得てから進める。

**テンプレートの場所（最初に絶対パスを解決すること）：** 本 skill が参照する `templates/` は、この SKILL.md と**同じフォルダ内**にある。自分の skill フォルダの場所が不明な場合は、skills 置き場（`.claude/skills/`・`.agents/skills/`・`~/.claude/skills/` 等）配下から `flow-setup/templates/` を Glob 等で探して絶対パスに解決してから作業を始める。見つからない場合は導入元（ai-dev-flow リポジトリ）のパスをユーザーに確認する。

## 実行手順

### Step 0: 対象リポジトリの調査（設置前に必ず実施）

以下を調査し、結果と適用方針をユーザーに提示して確認を得る：

1. **スタック確認**：package.json・フレームワーク・DB クライアント。前提スタックと異なる箇所は調整案を提示する
2. **既存資産の衝突確認**：`docs/開発プロセス/`・`docs/設計/設計書フォーマット.md`・AGENTS.md（CLAUDE.md）・vitest/playwright 設定・`.github/workflows/`・`src/test/` の既存有無。**既存ファイルは無断で上書きしない**（差分を提示して人間が判断）
3. **skill 群の導入確認**：flow-phase 系 skill と部品 skill（`flow-agent-roles`・`flow-review-policy`）が対象リポジトリで認識されているか（未導入なら README の導入手順を先に案内）

### Step 1: プロセスドキュメントの設置

`templates/docs/` を対象リポジトリの `docs/` へ配置する：

| テンプレート | 配置先 |
|---|---|
| `docs/開発プロセス/設計から実装までのフロー.md` | `docs/開発プロセス/`（フロー正典） |
| `docs/開発プロセス/テストレベル選定トリガー表.md` | 同上 |
| `docs/開発プロセス/テスト観点表テンプレート.md` | 同上 |
| `docs/開発プロセス/開発フロー実践ガイド.md` | 同上 |
| `docs/開発プロセス/ブランチ運用方針.md` | 同上（ブランチ戦略が異なる場合は調整） |
| `docs/設計/設計書フォーマット.md` | `docs/設計/` |

### Step 2: AGENTS.md（CLAUDE.md）へのフロー節追記

`templates/AGENTS_md_フロー節テンプレート.md` の内容を、対象リポジトリの AGENTS.md に追記する：

- AGENTS.md がない場合：CLAUDE.md に追記する（それもなければ AGENTS.md を新規作成し、CLAUDE.md から `@AGENTS.md` で参照させる）
- 既存の記述（コーディング規約等）は壊さず、フロー節・テスト指針を適切な位置に統合する
- テンプレート冒頭の HTML コメントは転記しない

### Step 3: テスト基盤の構築

1. **devDependencies のインストール**：

```bash
npm install -D vitest @vitest/coverage-v8 vite-tsconfig-paths @playwright/test dotenv
npx playwright install
```

2. **npm scripts の追記**（package.json。既存の同名 script がある場合は差分提示）：

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:e2e": "playwright test"
}
```

`lint`・`check-types`（`tsc --noemit`）がなければ併せて追加する。

3. **設定ファイルの配置**（`templates/test-infra/` から。★印は導入先に合わせて必ず調整）：

| テンプレート | 配置先 | 調整ポイント |
|---|---|---|
| `vitest.config.ts` | リポジトリルート | ★coverage の include（テスト整備済み範囲に限定） |
| `vitest.integration.config.ts` | リポジトリルート | — |
| `playwright.config.ts` | リポジトリルート | ★baseURL のポート番号（テンプレートは 3000） |
| `.env.test.example` | リポジトリルート | ★`.env.test` にコピーして値を埋める（DB接続先等） |
| `.env.e2e.example` | リポジトリルート | ★`.env.e2e` にコピーして値を埋める |
| `src-test/setup.ts`・`db-helpers.ts` | `src/test/` | db-helpers は Prisma 前提。DB が異なれば書き換え |

4. **CI workflow の配置**（`templates/github-workflows/` → `.github/workflows/`）：

- `ci.yml`：Lint + 型チェック + 単体・結合（内部）+ DB込み結合。★対象ブランチ名・DB イメージ・Prisma 手順を導入先に合わせる
- `playwright.yml`：E2E。★ポート番号・seed 手順を導入先に合わせる

5. **.gitignore への追記**：`.env.test`・`.env.e2e`・`coverage/`・`playwright-report/`・`test-results/`・`playwright/.auth/`

### Step 4: 併用推奨 skill の導入（任意）

前段（`flow-kickoff`）の要件深掘りで使う `grilling`（サードパーティ製）の導入をユーザーに提案し、希望すればインストールする：

```bash
npx skills add https://github.com/mattpocock/skills --skill grilling
```

導入しない場合も `flow-kickoff` は簡易深掘りにフォールバックして動くため、スキップ可。

### Step 5: 導入検証

司令塔自身が以下を実行して確認する：

```bash
npm run test          # テスト0件でも設定エラーなく完走すること
npm run lint          # 実行できること
npm run check-types   # 実行できること
```

- flow-phase 系 skill・`flow-agent-roles`・`flow-review-policy` が認識されていること
- `docs/開発プロセス/設計から実装までのフロー.md` が存在すること（各 skill の必須参照ファイル）

### Step 6: 完了通知と人間タスクの案内

```
開発フローの導入が完了しました。

設置した資産:
- プロセスドキュメント: docs/開発プロセス/（5点）+ docs/設計/設計書フォーマット.md
- AGENTS.md: フロー節・テスト指針を追記
- テスト基盤: vitest/playwright 設定・npm scripts・CI workflow・src/test/

人間にお願いするタスク（AIでは実施不可）:
- [ ] GitHub Secrets への E2E_EMAIL / E2E_PASSWORD の登録（E2E を CI で動かす場合）
- [ ] テスト用DBの用意と .env.test / .env.e2e の値の確定
- [ ] （任意）docs/設計/共通機能設計書.md の用意（レビュー基準が充実します）

最初の機能開発は「○○機能の開発を始めたいです」から始めてください（flow-kickoff が起動し、
要件の受付 → フロー設定（人間レビューの要否）の決定 → Phase 1 へ案内します。
要件が固まっていれば「○○の設計書を作って」で Phase 1 直行も可）。
```

## 禁止事項

- 既存ファイル（AGENTS.md・テスト設定・CI・docs）を差分提示なしに上書きしない
- 前提スタックと異なるリポジトリで、調整方針の人間確認なしにテンプレートを適用しない
- `.env.test`・`.env.e2e` に実際の値を入れたままコミットしない（example のみコミット可）
- 本 skill を機能開発のフローの一部として実行しない（導入は1回きり）
