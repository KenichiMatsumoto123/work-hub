# 日報・工数管理システム

日報入力、工数管理、勤怠管理を一つのWebアプリケーションで行えるシステムです。

## 機能

- **ログイン** — Google アカウントでのログイン（許可したメールアドレスのみ）
- **日報入力** — プロジェクト・タスク単位で予定/実績工数・進捗率を記録し、日報テキストを生成
- **工数管理** — 月次の工数集計・タイムシート表示
- **勤怠管理** — 出退勤・休憩時間の管理

## 技術スタック

- [TanStack Start](https://tanstack.com/start) / [TanStack Router](https://tanstack.com/router)
- [better-auth](https://www.better-auth.com/)（Google OAuth）
- Drizzle ORM / PostgreSQL
- React 19
- Tailwind CSS 4
- TypeScript
- Vite 7

## セットアップ

```bash
npm install
cp .env.example .env   # DATABASE_URL / POSTGRES_HOST_PORT とログイン設定を編集
npm run db:setup       # PostgreSQL 起動 + スキーマ反映（初回のみ）
```

`DATABASE_URL` のポート番号と `POSTGRES_HOST_PORT`（docker-compose のホスト側ポート）は一致させてください。

ログインには Google の OAuth クライアント（`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`）と
`BETTER_AUTH_SECRET` が必要です。取得・設定の手順は [docs/google-oauth.md](../../docs/google-oauth.md) を参照してください。

## 開発

```bash
npm run db:check   # DB 接続確認（任意）
npm run dev
```

## ビルド・起動

```bash
npm run build
npm start
```

## テスト

```bash
npm run test              # 単体・結合（DB不要）
npm run test:integration  # 結合（DB必要）
npm run test:e2e          # E2E（DB必要。Playwright が開発サーバを起動する）
```
