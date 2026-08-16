# Phase 10 実行検証証拠（Round 1）

- 機能：実績0hの保存
- 実施日時：2026-08-16 07:01 UTC
- 実行者：司令塔（独立実行）

## 実行検証結果

| チェック | コマンド | 結果 |
|---|---|---|
| 単体 + 結合（内部） | `npm run test` | PASS（226 tests / 11 files） |
| 結合（DB込み） | `DATABASE_URL=postgres://workhub:workhub_dev@127.0.0.1:5432/workhub_test npm run test:integration` | PASS（75 tests / 6 files） |
| Lint | `npm run lint` | 該当なし（本リポジトリ未導入。`check-types` で代替。`docs/開発プロセス/本リポジトリでの読み替え.md`） |
| 型チェック | `npm run check-types` | PASS |
| ビルド | `npm run build` | PASS |
| E2E（当該機能） | 対象なし（クリティカルパスの新規シナリオは起案しない。設計書「テストレベル判定」） | 対象なし |
| E2E（常設スイート） | `DATABASE_URL=.../workhub_e2e npm run test:e2e` | PASS（22 tests。親 E2E-1〜7 を含む `effort-normalize.test.ts` 7 本 + auth / daily-report / smoke） |
| テスト無改変 | `git diff 9741e0e --` 対象テスト 4 ファイル + `apps/web/e2e/` | 変更なし（Phase 7 承認コミット `9741e0e` から差分なし） |

## E2E コード化の記録

- コード化したシナリオ：対象なし（本差分の新規シナリオは起案しない。親 E2E-1〜7 の維持で足りる）
- 凍結仕様との差異：なし（既存 `apps/web/e2e/effort-normalize.test.ts` を改変していない）

## 実行時の補足

- 結合は開発 DB 名 `workhub` ではなく `workhub_test` を指定した（ガードB）
- E2E は `workhub_e2e` を新規作成し `npm run db:push -- --force` したうえで実行した
- この環境の Vite は既定で `::1:3000` のみ待受するため、`npx vite dev --host 127.0.0.1 --port 3000` を先に起動し、Playwright の `reuseExistingServer` で接続した（`E2E_BASE_URL=http://127.0.0.1:3000`）
- `BETTER_AUTH_SECRET=e2e-only-secret-e2e-only-secret-e2e-only`（CI の `playwright.yml` と同じ）
