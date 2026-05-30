# 日報・工数管理システム

日報入力、工数管理、勤怠管理を一つのWebアプリケーションで行えるシステムです。

## 機能

- **日報入力** — プロジェクト・タスク単位で予定/実績工数・進捗率を記録し、日報テキストを生成
- **工数管理** — 月次の工数集計・タイムシート表示
- **勤怠管理** — 出退勤・休憩時間の管理

## 技術スタック

- [TanStack Start](https://tanstack.com/start) / [TanStack Router](https://tanstack.com/router)
- React 19
- Tailwind CSS 4
- TypeScript
- Vite 7

## セットアップ

```bash
npm install
cp .env.example .env   # 必要に応じて DATABASE_URL / POSTGRES_HOST_PORT を編集
npm run db:setup       # PostgreSQL 起動 + スキーマ反映（初回のみ）
```

`DATABASE_URL` のポート番号と `POSTGRES_HOST_PORT`（docker-compose のホスト側ポート）は一致させてください。

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
