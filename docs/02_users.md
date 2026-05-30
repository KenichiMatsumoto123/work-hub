# 02. システム利用者（ロール別）

## 現状の実装: 認証なし・単一ユーザー前提

現状の `work-hub` には認証・認可の仕組みが一切実装されていない。以下の根拠から、単一ユーザーがローカルまたは単一環境で利用する前提で動作している。

- 認証ライブラリ（Better Auth 等）への依存が存在しない（`apps/web/package.json:14-22` に認証関連パッケージなし）。
- ログイン/登録ルートや `_authed` レイアウトルートが存在しない。ルートは `/`, `/timesheet`, `/attendance` の3つのみ（`apps/web/src/routes/`、`apps/web/src/routeTree.gen.ts:18-28`）。
- サーバ関数（createServerFn）にユーザー識別・認可チェックが無い。`saveReportFn` / `getReportsByMonthFn` 等は userId フィルタを持たず、全データを単一スコープで読み書きする（`apps/web/src/server/functions/reports.ts:30-103`）。
- `daily_reports` テーブルに userId / teamId 等の所有者カラムが無く、`date` 単一の一意制約（1日1件）で運用される（`apps/web/src/server/schema/reports.ts:15`）。
- ルート `__root.tsx` のグローバルナビは固定3リンクで、ユーザー情報・ログアウト等の表示が無い（`apps/web/src/routes/__root.tsx:45-50`）。

### ロール定義

| ロール | 説明 | 認可制御 |
|---|---|---|
| 利用者（単一） | 日報の入力・保存、3フォーマット生成、月次工数/勤怠表の閲覧を行う唯一の利用者 | なし（全画面・全データに無制限アクセス） |

現状、ロールによる画面・データの出し分けは存在しない。すべての画面・操作が無認証で利用可能。

## データの保存先と利用者の関係

- 入力中の一時データ: ブラウザの sessionStorage（自動保存。`apps/web/src/routes/index.tsx:97`）。
- テンプレート: ブラウザの localStorage（`apps/web/src/lib/storage.ts:10-26`）。
  - これらはブラウザ単位で保持されるため、別ブラウザ/端末では共有されない。
- 確定日報: PostgreSQL の `daily_reports`（サーバ共通。`apps/web/src/server/functions/reports.ts`）。
  - 単一スコープのため、同じ DB を参照する全利用者が同一データを見る（※実質単一ユーザー運用前提）。

## 将来構想（未実装）

requirements.md / implementation-plan.md には以下のロール・認証設計が記載されているが、現状未実装。

- `users`（メール+パスワード認証、Better Auth）(`apps/web/docs/requirements.md:124-135`、`apps/web/docs/implementation-plan.md:173-194`)。
- `teams` / `team_members`（role: `owner` | `member`）によるチーム共有（`apps/web/docs/requirements.md:136-154`）。
- `_authed` レイアウトの `beforeLoad` による認証チェック、サーバ関数への認証 middleware 付与（`apps/web/docs/implementation-plan.md:187,194`）。

## 未確認事項

- 本番 VPS デプロイ時に、リバースプロキシ等の外部レイヤで Basic 認証 / IP 制限等のアクセス制御が掛けられているかは、アプリコードからは確認できない（`docs/vps-deploy-commands.md` 等の運用ドキュメント確認が必要。※未確認）。
- 単一ユーザー運用であるという結論はコードからの判断であり、実運用での共有有無は未確認。
