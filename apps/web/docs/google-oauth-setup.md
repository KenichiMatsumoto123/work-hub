# Google OAuth ログイン設定ガイド（work-hub）

Better Auth + Google OAuth を使ったログイン機能のセットアップ手順と、その背景にある仕組みの解説。

---

## 1. なぜ Google Cloud での設定が必要なのか

### OAuth の登場人物は 3 者

```
①ユーザー（ログインする人）
②アプリ（ログインを受け付ける側 = サービス）  ← work-hub はここ
③Google（認証する側 = ID プロバイダ）
```

- 普段「Google でログイン」をボタン一つで使えるとき、自分は **①ユーザー**。設定は何もいらない。
- いま作っている `work-hub` は **②アプリ** の側。**普段使っている他サービスも、その開発者が裏で同じ設定を事前に済ませている**。見えていないだけ。

### なぜアプリ側の事前登録が要るのか

Google は「ユーザーの個人情報（メール・名前）を、リクエストしてきたアプリに渡してよいか」を判断する必要がある。
事前登録が不要だと、悪意あるサイトが勝手に「Google でログイン」を名乗って情報を抜き放題になる。
そのため Google は「ログイン機能を使いたいアプリは事前に身元を登録せよ」と要求し、見返りに以下を発行する。


| 発行物               | 意味               | 例え                    |
| ----------------- | ---------------- | --------------------- |
| **Client ID**     | アプリの公開された名札      | 会員番号                  |
| **Client Secret** | そのアプリ本人だと証明する合言葉 | パスワード                 |
| **リダイレクト URI**    | 認証後に戻ってくる先（事前申告） | 「ここ以外には情報を送るな」という安全装置 |


これは Google に限らず、GitHub・LINE・Microsoft 等、**あらゆる OAuth ログインで開発者側が必ず行う共通の手続き**。

---

## 2. 「事前登録された URI にだけ結果を返す」仕組み

OAuth ログインは、最終的に Google がアプリへ「認証 OK だった」という情報（認可コード）を URL に付けて送り返すことで完了する。

```
http://localhost:3000/api/auth/callback/google?code=4/abc123...
                                                ↑この code が認証成功の証
```

もし送り先を自由に指定できると、攻撃者が本物の Client ID を使って「認証後は [https://evil.com/steal](https://evil.com/steal) に返して」と指定し、`code` を横取り → なりすましログインが可能になってしまう。

これを防ぐため Google は：

> 結果を送り返す先（リダイレクト URI）を事前登録させ、**リクエスト時に指定された URI が登録済みリストと完全一致しない限り結果を一切返さない**

というルールにしている。＝ **情報の届け先を事前に固定し、横取りを物理的に不可能にする安全装置**。
登録外の URI を指定すると `redirect_uri_mismatch` エラーで止まる。

---

## 3. なぜ「特定の Google アカウント／Workspace」に紐づくのか

- **申請相手は Google で正しい。** OAuth サービスを提供しているのは Google。
- ただし登録情報には **所有者・管理責任者** が必要：
  - このアプリ登録は誰が作り、誰が管理するのか
  - Client Secret が漏れたら誰が再発行・無効化するのか
  - 課金は誰に請求するのか／廃止時は誰が消すのか
- その所有単位が **Google Cloud プロジェクト**で、プロジェクトは必ずいずれかの Google アカウント／組織（Workspace）に属する。


|                            | 例え             |
| -------------------------- | -------------- |
| Google                     | 役所（登記を受け付ける機関） |
| OAuth クライアント登録             | 会社の登記          |
| Google Cloud プロジェクト        | 登記された会社そのもの    |
| 自分の Google アカウント／Workspace | その会社の代表者・所有者   |


### 「内部 / 外部」はログイン可能範囲の設定（所有者とは別レイヤー）


| 設定               | ログインできる人               | 用途                     |
| ---------------- | ---------------------- | ---------------------- |
| **内部（Internal）** | その Workspace 組織のメンバーだけ | 社内ツール（work-hub はこちら推奨） |
| **外部（External）** | 任意の Google アカウント       | 一般公開サービス               |


work-hub が Workspace に強く紐づいて見えたのは、社内限定ツールなので「内部」を推奨したから。**これは今回のケース特有の選択**であり、社外にも使わせたいなら「外部」を選べばよい。

---

## 4. セットアップ手順

### ステップ 1：Google Cloud プロジェクトの作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 上部のプロジェクト選択 → **「新しいプロジェクト」**
3. プロジェクト名（例：`work-hub`）→ **作成**
4. 作成したプロジェクトを選択状態にする

### ステップ 2：OAuth 同意画面の設定

1. 左メニュー → **「API とサービス」→「OAuth 同意画面」**
2. **User Type**：
  - 社内（Google Workspace）限定なら **「内部（Internal）」** を選択（推奨。`@arumako.com` のみログイン可・審査不要）
  - Workspace を使っていない場合は「外部（External）」（テストユーザー登録が必要）
3. アプリ情報：
  - アプリ名（例：`Work Hub`）
  - ユーザーサポートメール／デベロッパー連絡先
4. **スコープ**：デフォルト（`email`, `profile`, `openid`）のままで OK
5. 保存

### ステップ 3：OAuth 2.0 クライアント ID の作成

1. 左メニュー → **「API とサービス」→「認証情報」**
2. **「+ 認証情報を作成」→「OAuth クライアント ID」**
3. **アプリケーションの種類**：**「ウェブアプリケーション」**
4. **名前**：任意（例：`work-hub-web-local`）
5. **承認済みの JavaScript 生成元**：
  ```
   http://localhost:3000
  ```
6. **承認済みのリダイレクト URI**（最重要）：
  ```
   http://localhost:3000/api/auth/callback/google
  ```
   ⚠️ 1 文字でも違うと `redirect_uri_mismatch`。Better Auth の標準コールバックパスは `/api/auth/callback/{providerId}`。
   （work-hub の API ルートは `apps/web/src/routes/api/auth/$.ts` のキャッチオール）
7. **作成**

### ステップ 4：取得した値を `.env` に設定

ルートの `.env`（`work-hub/.env`）に記入：

```
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=（ランダム文字列）
ALLOWED_EMAIL_DOMAIN=arumako.com
```

`BETTER_AUTH_SECRET` の生成例（PowerShell）：

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

> `.env` は起動時に 1 回だけ読み込まれる（`apps/web/src/server/env.ts`）。**設定後は dev サーバーを再起動する**こと。

### 本番デプロイ時

同じ OAuth クライアントに本番 URL のリダイレクト URI を追加（例：`https://your-domain.com/api/auth/callback/google`）。ローカル用と本番用でクライアントを分けてもよい。

---

## 5. つまずきやすいポイント


| 症状                                 | 原因                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `redirect_uri_mismatch`            | リダイレクト URI の綴り・末尾スラッシュ・https/http の違い                                                            |
| ログインできるが弾かれる                       | `ALLOWED_EMAIL_DOMAIN=arumako.com` 以外でログインした（`apps/web/src/server/auth.ts` の `databaseHooks` 制限） |
| 「このアプリは確認されていません」警告                | 同意画面が「外部」かつ未審査。「内部」にすれば回避できる                                                                     |
| `CLIENT_ID_AND_SECRET_REQUIRED`    | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` が空。`.env` に値を設定し再起動                                  |
| `Base URL could not be determined` | `BETTER_AUTH_URL` が未設定                                                                           |


---

## 6. OAuthログインの仕組み（30秒で説明用）

**ひとことで言うと**：「パスワードをアプリに渡さず、Google に本人確認を代行してもらう仕組み」。

**流れ（5ステップ）**：

各ステップで、どの環境変数（`.env` の値）が使われるかを【】内に示す。

```
① ユーザーが「Googleでログイン」を押す
        ↓
② アプリが Google に送り出す
   ・「うちは登録済みアプリです」と名乗る   【GOOGLE_CLIENT_ID】
   ・戻り先URL（…/api/auth/callback/google）を組み立てる   【BETTER_AUTH_URL】
        ↓
③ ユーザーが Google 上でログイン・許可（パスワードは Google にしか渡らない）
        ↓
④ Google が「この人は本人だよ」という証明(code)を、
   事前登録したURLにだけ返す   ※戻り先は【BETTER_AUTH_URL】基準で一致が必要
        ↓
⑤ アプリが証明を確認し、ログイン完了
   ・code を交換する際にアプリ本人だと証明   【GOOGLE_CLIENT_SECRET】（サーバー間のみ）
   ・取得したメールが許可ドメインか判定   【ALLOWED_EMAIL_DOMAIN】
   ・セッションCookieを署名・暗号化して発行   【BETTER_AUTH_SECRET】
```

> ★リダイレクトURIは「環境変数そのもの」ではなく、`BETTER_AUTH_URL` を基準に組み立てた `…/api/auth/callback/google`。この組み立て結果が Google Cloud に登録した値と一致しないと ④ で `redirect_uri_mismatch` になる。

**ポイント3つ**：

1. **アプリはパスワードを一切見ない** — 本人確認は Google が代行するので安全。
2. **アプリは事前に Google へ登録が必要** — その見返りが Client ID（名札）と Client Secret（合言葉）。
3. **証明の届け先（リダイレクトURI）は事前固定** — 登録外のURLには返さないので横取りされない。

**役割の整理**：


| 登場人物            | 役割               |
| --------------- | ---------------- |
| ユーザー            | ログインする人          |
| このアプリ（work-hub） | ログインを受け付ける側      |
| Google          | 本人確認する側（IDプロバイダ） |


