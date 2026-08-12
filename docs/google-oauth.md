# Google ログイン（better-auth）の設定

このアプリのログインは [better-auth](https://www.better-auth.com/) の Google OAuth を使う。
ログインしていないアクセスは全て `/login` へリダイレクトされる。

## 仕組み

| 役割 | 場所 |
|---|---|
| better-auth の設定（Google プロバイダ・許可リスト） | `apps/web/src/server/auth/auth.ts` |
| 認証エンドポイント `/api/auth/*` | `apps/web/src/routes/api/auth/$.ts` |
| ログイン画面 | `apps/web/src/routes/login.tsx` |
| ログイン判定とリダイレクト（全ページ共通） | `apps/web/src/routes/__root.tsx` の `beforeLoad` |
| セッション情報の取得（サーバ関数） | `apps/web/src/server/functions/auth.ts` |
| user / session / account / verification テーブル | `apps/web/src/server/schema/auth.ts` |

ログインの流れ:

1. 未ログインで保護ページを開くと `/login?redirect=<元のパス>` へリダイレクトされる
2. 「Google でログイン」で Google の同意画面へ移動する
3. Google が `/api/auth/callback/google` へ戻し、better-auth が user と session を作成する
4. 許可リスト（`AUTH_ALLOWED_EMAILS`）に無いメールアドレスなら user を作らずに拒否し、
   `/login?error=...` に戻して理由を表示する
5. 許可されていれば元のページ（`redirect`）へ戻る

## 1. Google Cloud で OAuth クライアントを作る

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成（既存でも可）
2. 「APIとサービス」→「OAuth 同意画面」を設定する
   - User Type: 社内利用のみなら「内部」、Gmail アカウントを使うなら「外部」
   - 「外部」かつ公開しない場合は、テストユーザーに自分のアカウントを追加する
3. 「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
   - アプリケーションの種類: **ウェブ アプリケーション**
   - 承認済みの JavaScript 生成元: `http://localhost:3000`（開発）／`https://<公開URL>`（本番）
   - 承認済みのリダイレクト URI:
     - 開発: `http://localhost:3000/api/auth/callback/google`
     - 本番: `https://<公開URL>/api/auth/callback/google`
4. 発行された **クライアント ID** と **クライアント シークレット** を控える

リダイレクト URI は `<BETTER_AUTH_URL>/api/auth/callback/google` と完全に一致している必要がある
（末尾のスラッシュや http/https の違いでも `redirect_uri_mismatch` になる）。

## 2. 環境変数を設定する

`.env`（リポジトリ直下。`.env.example` をコピーして編集）:

```bash
BETTER_AUTH_SECRET=<openssl rand -base64 32 の出力>
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<クライアントID>
GOOGLE_CLIENT_SECRET=<クライアントシークレット>
AUTH_ALLOWED_EMAILS=you@example.com
```

| 変数 | 必須 | 説明 |
|---|---|---|
| `BETTER_AUTH_SECRET` | 本番で必須 | セッションクッキーの署名鍵。32文字以上のランダム文字列 |
| `BETTER_AUTH_URL` | 推奨 | アプリの公開URL。未設定だとリクエストのホストから推定される |
| `GOOGLE_CLIENT_ID` | 本番で必須 | Google の OAuth クライアントID |
| `GOOGLE_CLIENT_SECRET` | 本番で必須 | 同シークレット |
| `AUTH_ALLOWED_EMAILS` | 任意（実質必須） | ログインを許可するメール／ドメイン。**未設定だと Google アカウントを持つ誰でもログインできる** |

`AUTH_ALLOWED_EMAILS` はカンマ・空白・改行で区切って複数指定できる。
`@example.com` のように `@` から書くとそのドメイン全体を許可する（サブドメインは含まない）。

本番（`NODE_ENV=production`）では必須の変数が無いと起動時にエラーになる。
開発時は警告を出して起動するが、Google のクライアント情報が無いとログイン自体は失敗する。

環境変数は `DATABASE_URL` と同じく「環境変数 → 上位ディレクトリを遡って見つけた `.env`」の順で解決する
（`apps/web/src/server/env.ts`）。

## 3. DB にテーブルを作る

```bash
npm run db:push
```

`user` / `session` / `account` / `verification` の4テーブルが作成される。

## 4. 動作確認

```bash
npm run dev
```

`http://localhost:3000/` を開くと `/login` にリダイレクトされ、
「Google でログイン」からログインできる。

## ログインできないとき

| 症状 | 原因と対処 |
|---|---|
| `redirect_uri_mismatch` | GCP の承認済みリダイレクト URI と `<BETTER_AUTH_URL>/api/auth/callback/google` が不一致 |
| `invalid_client` | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` が未設定または誤り |
| ログイン画面に「ログインを許可されていません」 | `AUTH_ALLOWED_EMAILS` にそのアドレスが含まれていない |
| ログイン後すぐログイン画面に戻る | クッキーが保存されていない。`BETTER_AUTH_URL` が実際のアクセス URL と一致しているか確認する |
| 起動時に `BETTER_AUTH_SECRET を解決できませんでした` | 本番で必須の環境変数が未設定。`.env` を確認する |

## テスト

| 種別 | コマンド | DB |
|---|---|---|
| 単体（許可リスト・設定解決・リダイレクト先の検証） | `npm run test` | 不要 |
| 結合（better-auth と drizzle スキーマの結線・拒否の挙動） | `npm run test:integration` | 必要 |
| E2E（未ログインのリダイレクト・ログイン済み表示・ログアウト） | `npm run test:e2e` | 必要 |

E2E は Google のログイン画面を自動化せず、テスト用ユーザーのセッションを直接発行して
ログイン済みの状態を作る（`apps/web/e2e/auth.setup.ts`）。
