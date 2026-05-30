# 07. 技術スタック

`work-hub` の技術スタックをバージョン併記で整理する。バージョンは各 `package.json` の宣言値（範囲指定 `^`）であり、`node_modules` 内の確定値とは厳密には一致しない可能性がある（※ロックファイル未確認）。

## 全体構成

- モノレポ（npm workspaces）。`apps/*` と `packages/*` をワークスペースに含む（`package.json:6-9`）。
  - `apps/web`（`@work-hub/web`）… アプリ本体（`apps/web/package.json:2`）。
  - `packages/shared`（`@work-hub/shared` 想定）… 現状ほぼ空（`export {}` のみ。`packages/shared/src/index.ts:1-2`）。
- フロント + サーバ一体型。TanStack Start の `createServerFn` でサーバ関数を定義し、クライアントから直接呼び出す（BFF 的な API ルートは廃止済み。`apps/web/src/server/functions/reports.ts`、`docs/01_background.md:31`）。
- DB は PostgreSQL（`postgres` ドライバ + Drizzle ORM）。接続は `apps/web/src/server/db.ts`。

## ランタイム / フレームワーク

| 項目 | バージョン | 用途 | 根拠 |
|---|---|---|---|
| react | ^19.2.4 | UI ライブラリ | `apps/web/package.json:19` |
| react-dom | ^19.2.4 | DOM レンダラ | `apps/web/package.json:20` |
| @tanstack/react-router | ^1.167.4 | ルーティング（ファイルベース） | `apps/web/package.json:15` |
| @tanstack/react-start | ^1.166.16 | フルスタックフレームワーク（SSR / createServerFn / Vite プラグイン） | `apps/web/package.json:16` |
| TypeScript | ^5.9.3 | 型システム | `apps/web/package.json:31` |
| Node.js | engines 指定なし（両 `package.json` に engines フィールド不在）。本番起動は `node serve.mjs`（`apps/web/package.json:9`）。`@types/node ^25.5.0`（`:26`）から比較的新しい Node を想定（※推測） | 実行環境 | ルート `package.json:1-27`、`apps/web/package.json:9,26` |

SSR が有効（`apps/web/src/routeTree.gen.ts:101` の `ssr: true`、`scrollRestoration: true`。`apps/web/src/router.tsx:7`）。

## データベース / ORM

| 項目 | バージョン | 用途 | 根拠 |
|---|---|---|---|
| PostgreSQL | 16-alpine（ローカル Docker イメージ） | RDBMS | `docker-compose.yml:3` |
| drizzle-orm | ^0.38.0 | ORM（スキーマ定義・クエリ） | `apps/web/package.json:17` |
| postgres | ^3.4.0 | PostgreSQL ドライバ（postgres-js） | `apps/web/package.json:18` |
| drizzle-kit | ^0.28.0 | マイグレーション/Studio（ルート devDeps） | `package.json:25` |

- Drizzle 設定: `drizzle.config.ts`（dialect: postgresql、schema: `apps/web/src/server/schema/index.ts`、出力: `./drizzle`）。
- DB 接続: `apps/web/src/server/db.ts`（`DATABASE_URL` 環境変数、無ければ `../../.env` を簡易パースし、最終フォールバックは `postgres://workhub:workhub_dev@localhost:5432/workhub`）。接続は遅延初期化（Proxy 経由）。
- DB 関連 npm スクリプト（ルート `package.json:16-22`）: `db:generate` / `db:push` / `db:studio` / `db:up`（docker compose up -d）/ `db:down` / `db:check`（`scripts/check-db.mjs`）/ `db:setup`（up → wait → push）。

## バリデーション

| 項目 | バージョン | 用途 | 根拠 |
|---|---|---|---|
| zod | ^3.24.0 | スキーマバリデーション（依存に存在） | `apps/web/package.json:21` |

注: サーバ関数の入力受け取りは `createServerFn().inputValidator(...)` で素の関数を使用しており、reports.ts では zod を直接使っていない（`apps/web/src/server/functions/reports.ts:42,60,99`）。zod の具体的な使用箇所は本調査では未特定（※未確認）。

## スタイリング

| 項目 | バージョン | 用途 | 根拠 |
|---|---|---|---|
| tailwindcss | ^4.2.1 | CSS フレームワーク（v4） | `apps/web/package.json:30` |
| @tailwindcss/vite | ^4.2.1 | Tailwind v4 用 Vite プラグイン | `apps/web/package.json:25` |

- グローバル CSS は `apps/web/src/styles/app.css`（各ルートで import。`apps/web/src/routes/__root.tsx:10` 他）。
- フォントは Google Fonts（IBM Plex Sans JP / IBM Plex Mono）を head で読み込み（`apps/web/src/routes/__root.tsx:20-23`）。

## ビルド / ツール

| 項目 | バージョン | 用途 | 根拠 |
|---|---|---|---|
| vite | ^7.3.1 | ビルド / 開発サーバ（dev は port 3000） | `apps/web/package.json:32`、`apps/web/vite.config.ts:9` |
| @vitejs/plugin-react | ^5.2.0 | React 用 Vite プラグイン | `apps/web/package.json:29` |
| vite-tsconfig-paths | ^6.1.1 | tsconfig paths 解決（`~/...` エイリアス） | `apps/web/package.json:33` |
| @types/node | ^25.5.0 | Node 型定義 | `apps/web/package.json:26` |
| @types/react / @types/react-dom | ^19.2.14 / ^19.2.3 | React 型定義 | `apps/web/package.json:27-28` |

Vite プラグイン構成: `tsConfigPaths()` / `tanstackStart()` / `viteReact()` / `tailwindcss()`（`apps/web/vite.config.ts:11-16`）。

## テスト

| 項目 | バージョン | 用途 | 根拠 |
|---|---|---|---|
| vitest | ^3.0.0 | 単体テスト | `apps/web/package.json:34` |
| @playwright/test | ^1.49.0 | E2E テスト | `apps/web/package.json:24` |

- 単体テスト: `apps/web/src/lib/*.test.ts`（`report-generator.test.ts`、`time-utils.test.ts`）。`npm run test`（= `vitest run`）。
- E2E: `apps/web/e2e/`（`smoke.test.ts`、`daily-report.test.ts`）。設定 `apps/web/playwright.config.ts`。`npm run test:e2e`（= `playwright test`）。

## 実行・デプロイ

| 項目 | 内容 | 根拠 |
|---|---|---|
| 開発起動 | `npm run dev`（= `vite dev`、port 3000） | `package.json:11`、`apps/web/package.json:7`、`apps/web/vite.config.ts:9` |
| ビルド | `npm run build`（= `vite build`） | `apps/web/package.json:8` |
| 本番起動 | `npm run start`（= `node serve.mjs`） | `apps/web/package.json:9` |
| 本番エントリ | `apps/web/serve.mjs`（本番用サーバエントリーポイント） | コミット履歴「本番用サーバエントリーポイントを追加」、ファイル実在を確認 |
| VPS デプロイ手順 | `docs/vps-deploy-commands.md` 等 | コミット履歴「VPSデプロイ手順書を追加」 |
| ローカル DB | docker-compose（PostgreSQL 16-alpine、user/pass/db = workhub/workhub_dev/workhub、ポート `${POSTGRES_HOST_PORT:-5432}`） | `docker-compose.yml` |

## 言語 / モジュール

- TypeScript（ESM。ルート/web ともに `"type": "module"`。`package.json:5`、`apps/web/package.json:5`）。
- パスエイリアス `~/`（`apps/web/tsconfig.json` + `vite-tsconfig-paths`。コード中の `~/lib/...` 等）。
- パッケージマネージャは npm（workspaces 使用。`-w apps/web` 指定のスクリプトから判断。`package.json:11-15`）。

## 未確認事項

- Node.js のバージョン要件（engines 指定）は `package.json` に無く未確認（`@types/node ^25.5.0` から比較的新しい Node を想定。※推測）。
- ロックファイル（`package-lock.json` 等）を未確認のため、各依存の確定インストールバージョンは未検証（※未確認）。
- `serve.mjs` の内部実装（使用ポート・SSR ハンドラ・静的配信方法）は本ファイルでは未読（※未確認）。
- zod の実使用箇所（フォーム検証等）は本調査では特定できていない（reports.ts では未使用。※未確認）。
- `packages/shared` は現状実体が無い（`export {}` のみ）ため、ビルド/参照上の役割は将来構想とみなす（`packages/shared/src/index.ts:1-2`）。
