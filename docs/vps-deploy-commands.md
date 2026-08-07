# さくらVPS デプロイ手順（実行コマンド一覧）

## 前提
- VPS: さくらVPS 1GB
- OS: Ubuntu 24.04
- IP: 49.212.187.161
- アプリ: work-hub（TanStack Start + PostgreSQL）

---

## 1. SSH接続

```bash
ssh ubuntu@49.212.187.161
```
VPSにSSH接続する。`ubuntu`はOSのログインユーザー名。

---

## 2. SSH接続トラブルシューティング

### ホストキー警告の解消
```bash
ssh-keygen -R 49.212.187.161
```
OS再インストールでサーバーの識別キーが変わった場合、ローカルPCに記録されている古いキー情報を削除する。

### 初回接続時の確認
```
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```
`yes`と入力。初回接続時にサーバーのキーをローカルに記録するための確認。

---

## 3. システム更新

```bash
sudo apt update && sudo apt upgrade -y
```
- `sudo` — 管理者権限で実行
- `apt update` — 利用可能なソフトウェアの一覧を最新化
- `apt upgrade -y` — インストール済みのソフトウェアをすべて最新版に更新。`-y`は確認をすべて「はい」で自動応答

---

## 4. Node.js のインストール

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```
Node.js 22.x 公式のリポジトリ（ソフトウェア配布元）をaptの参照先リストに登録する。Ubuntuの`apt`は登録されたリポジトリからしかインストールできないため、最新バージョンを取得するために必要。

```bash
sudo apt install -y nodejs
```
Node.js をインストール。

```bash
node -v
npm -v
```
インストールされたバージョンの確認。

---

## 5. PostgreSQL のインストール

```bash
sudo apt install -y postgresql postgresql-contrib
```
PostgreSQL本体と追加ユーティリティをインストール。

```bash
sudo systemctl status postgresql
```
PostgreSQLが正常に起動しているか確認。`active`と表示されればOK。

---

## 6. データベースのセットアップ

```bash
sudo -u postgres psql
```
- `sudo -u postgres` — OSの`postgres`ユーザーとしてコマンドを実行
- `psql` — PostgreSQLの対話型クライアントを起動

PostgreSQLインストール時に自動作成される`postgres`ユーザー（DB管理者）として接続する。

```sql
CREATE USER workhub WITH PASSWORD 'ab958533';
```
アプリ専用のDBユーザー`workhub`を作成。管理者権限ではなく、必要な権限だけを持つユーザー。パスワードはシングルクォートで囲む必要がある。

```sql
CREATE DATABASE workhub OWNER workhub;
```
`workhub`という名前のデータベースを作成し、所有者を`workhub`ユーザーに設定。所有者はテーブルの作成・変更・削除などが可能。

```sql
\q
```
psqlを終了し、元の`ubuntu`ユーザーのシェルに戻る。

### パスワード変更が必要な場合
```sql
ALTER USER workhub WITH PASSWORD 'ab958533';
```
既存ユーザーのパスワードを上書き変更する。

---

## 7. Nginx のインストール

```bash
sudo apt install -y nginx
```
Nginxをインストール。リバースプロキシとして使用し、外部からのHTTPリクエスト（ポート80）を内部のNode.jsアプリ（ポート3000）に転送する。

---

## 8. GitHubからコードを取得

### VPS上でSSH鍵を作成
```bash
ssh-keygen -t ed25519 -C "vps-deploy"
```
VPSからGitHub（privateリポジトリ）に接続するためのSSH鍵ペアを作成。`-C "vps-deploy"`は鍵を識別するためのコメント。Enter連打でパスフレーズなしで作成。

### 公開鍵を表示
```bash
cat ~/.ssh/id_ed25519.pub
```
表示された公開鍵をGitHub → Settings → SSH and GPG keys → New SSH key に登録する（Authentication Key）。

### GitHub接続確認
```bash
ssh -T git@github.com
```
`Hi <ユーザー名>! You've successfully authenticated`と表示されれば成功。

### コードのクローン
```bash
cd /opt
sudo mkdir work-hub
```
`/opt`はLinuxで追加のアプリケーションを置くための標準的なディレクトリ。`work-hub`ディレクトリを作成。

```bash
sudo chown ubuntu:ubuntu work-hub
```
- `chown` — change owner（所有者変更）
- `sudo mkdir`で作成したディレクトリは`root`が所有者になるため、`ubuntu`ユーザーが書き込めるよう所有者を変更

```bash
git clone git@github.com:KenichiMatsumoto123/work-hub.git work-hub
```
GitHubからコードを取得。`sudo`なしで実行することで`ubuntu`ユーザーのSSH鍵が使われる。

---

## 9. アプリのビルドと起動

### 依存関係のインストール
```bash
cd /opt/work-hub
npm install
```
`package.json`に記載された依存パッケージをインストール。

### 環境変数ファイルの作成
```bash
echo 'DATABASE_URL=postgresql://workhub:ab958533@localhost:5432/workhub' > .env
```
アプリがDBに接続するための接続文字列を`.env`ファイルに保存。パスワードは`CREATE USER`で設定したものと一致させる必要がある。

### DBスキーマの適用
```bash
npm run db:push
```
Drizzle ORMが定義したテーブルをPostgreSQLに作成する。

### ビルド
```bash
npm run build
```
アプリを本番用にビルド。`dist/`ディレクトリに出力される。

### 起動
```bash
npm run start &
```
アプリをバックグラウンドで起動。`&`をつけると続けてコマンドが打てる。

### ポート3000が使用中の場合
```bash
kill $(lsof -t -i:3000)
```
ポート3000を使用しているプロセスを停止する。

---

## 10. Nginx の設定

### 設定ファイルの作成
```bash
sudo nano /etc/nginx/sites-available/work-hub
```
nanoエディタでNginxの設定ファイルを作成。以下の内容を貼り付ける：

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```
- `listen 80` — ポート80（HTTP）でリクエストを受け付ける
- `server_name _` — すべてのホスト名にマッチ
- `proxy_pass http://localhost:3000` — 受けたリクエストをNode.jsアプリ（ポート3000）に転送
- `proxy_set_header` — 元のリクエスト情報（IPアドレスなど）をアプリに渡す

Ctrl+O → Enter（保存）→ Ctrl+X（終了）。

### 設定の有効化
```bash
sudo ln -s /etc/nginx/sites-available/work-hub /etc/nginx/sites-enabled/
```
設定ファイルへのシンボリックリンクを`sites-enabled`に作成して有効化。

```bash
sudo rm /etc/nginx/sites-enabled/default
```
Nginxのデフォルト設定を無効化。

### 設定テスト
```bash
sudo nginx -t
```
設定ファイルの文法チェック。`syntax is ok`と`test is successful`が表示されればOK。

### Nginx再起動
```bash
sudo systemctl restart nginx
```
設定を反映するためにNginxを再起動。

---

## 11. さくらVPS コントロールパネルの設定

### パケットフィルター
- **ポート80（HTTP）を許可** — ブラウザからのアクセスを受け付けるために必要
- **ポート22（SSH）を許可** — SSH接続用（デフォルトで許可済みのはず）
- **ポート3000は許可不要** — Nginx経由でアクセスするため、外部に直接公開しない

---

## アクセス確認

ブラウザで以下にアクセス：
```
http://49.212.187.161
```

---

## 12. pm2 によるアプリの常駐化

### pm2のインストール
```bash
sudo npm install -g pm2
```
pm2はNode.jsアプリのプロセスマネージャー。アプリの常駐化、自動再起動、ログ管理などを行う。`-g`でグローバルインストール（どのディレクトリからでも使える）。

### pm2でアプリを起動
```bash
cd /opt/work-hub
kill $(lsof -t -i:3000) 2>/dev/null
pm2 start apps/web/serve.mjs --name work-hub
```
- 既にポート3000で動いているプロセスがあれば停止
- pm2で`work-hub`という名前でアプリを登録・起動

### 起動状態の確認
```bash
pm2 status
```
`work-hub`が`online`と表示されていればOK。

### サーバー再起動時の自動起動設定
```bash
pm2 save
```
現在のpm2のプロセスリストを保存。

```bash
pm2 startup
```
自動起動用のコマンドが表示されるので、そのままコピペして実行する。例：
```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```
これにより、VPSが再起動してもpm2とアプリが自動的に起動する。

### pm2 よく使うコマンド
```bash
pm2 status          # 状態確認
pm2 logs work-hub   # ログ表示
pm2 restart work-hub # 再起動
pm2 stop work-hub   # 停止
pm2 delete work-hub # 登録解除
```

---

## 13. Nginx の基本認証設定

### apache2-utilsのインストール
```bash
sudo apt install -y apache2-utils
```
`htpasswd`コマンドを使うためのツール。基本認証用のパスワードファイルを作成する。

### パスワードファイルの作成
```bash
sudo htpasswd -cb /etc/nginx/.htpasswd arumako 123456
```
- `htpasswd` — 基本認証用のパスワードファイルを作成するツール
- `-c` — ファイルを新規作成
- `-b` — パスワードをコマンドラインで指定
- `/etc/nginx/.htpasswd` — パスワードファイルの保存先
- `arumako` — ユーザー名
- `123456` — パスワード

### Nginx設定ファイルに基本認証を追加
```bash
sudo nano /etc/nginx/sites-available/work-hub
```
内容をすべて以下に書き換える：

```nginx
server {
    listen 80;
    server_name _;

    auth_basic "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```
- `auth_basic "Restricted"` — 基本認証を有効化。ブラウザに表示されるダイアログのメッセージ
- `auth_basic_user_file` — 認証に使うパスワードファイルのパス

Ctrl+O → Enter（保存）→ Ctrl+X（終了）。

### 設定テストと反映
```bash
sudo nginx -t
sudo systemctl restart nginx
```

ブラウザでアクセスすると、ユーザー名とパスワードの入力画面が表示される。

---

## 14. Let's Encrypt によるSSL化（HTTPS対応）

### 前提

- 独自ドメイン `work-hub.arumako-matsumoto.com` のAレコードが VPS の IP（`49.212.187.161`）に向いていること
- 確認コマンド（ローカルPCでOK）：
```bash
nslookup work-hub.arumako-matsumoto.com
```
`Address: 49.212.187.161` が返ればOK（2026-06-13 確認済み）。

Let's Encrypt は「ドメインの所有確認」を行って無料のSSL証明書を発行する認証局。IPアドレスのみでは実質発行できないため独自ドメインが必須。証明書の有効期限は90日と短いが、certbot が自動更新するため運用の手間はない。

### 14-1. さくらVPS パケットフィルターでポート443を許可

コントロールパネル → パケットフィルター → **ポート443（HTTPS）を許可**。

- 証明書発行時のドメイン所有確認（HTTP-01チャレンジ）はポート80を使うが、発行後のHTTPSアクセスには443が必要

### 14-2. Nginx設定の修正（certbot実行前の準備）

```bash
sudo nano /etc/nginx/sites-available/work-hub
```
内容をすべて以下に書き換える：

```nginx
server {
    listen 80;
    server_name work-hub.arumako-matsumoto.com;

    location / {
        auth_basic "Restricted";
        auth_basic_user_file /etc/nginx/.htpasswd;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

変更点は3つ：

- `server_name _` → `server_name work-hub.arumako-matsumoto.com` — certbot は `server_name` を見て「どのserverブロックにSSL設定を追加するか」を特定するため、ドメイン名の明示が必須
- `auth_basic` をserver直下から `location /` 内へ移動 — server直下に置くと、Let's Encrypt のドメイン所有確認（`/.well-known/acme-challenge/` へのアクセス）までBasic認証でブロックされ、証明書の発行・自動更新が失敗する。`location /` 内に置けば、certbot が確認時に一時追加するlocationには認証がかからない
- `proxy_set_header X-Forwarded-Proto $scheme;` を追加 — 「元のリクエストがhttpsだった」という情報をアプリに伝える。secure cookie の発行やリダイレクトURLの組み立てに必要（特にログイン機能で重要）

```bash
sudo nginx -t
sudo systemctl reload nginx
```
`reload` は接続を切らずに設定だけを再読み込みする（`restart` よりも安全）。

### 14-3. certbot のインストール

```bash
sudo apt install -y certbot python3-certbot-nginx
```
- `certbot` — Let's Encrypt の証明書を取得・更新する公式ツール
- `python3-certbot-nginx` — Nginxの設定を自動で書き換えるプラグイン

※公式はsnap版を推奨しているが、Ubuntu 24.04 のapt版で十分新しい。メモリ1GBのVPSではsnapdを常駐させないapt版のほうが軽量。

### 14-4. 証明書の発行とNginxへの自動設定

```bash
sudo certbot --nginx -d work-hub.arumako-matsumoto.com
```
- `--nginx` — Nginxプラグインを使用。ドメイン所有確認とNginx設定の書き換えを自動で行う
- `-d` — 証明書を発行するドメイン名

対話で聞かれること：

1. **メールアドレス** — 証明書の期限切れ警告などの通知先
2. **利用規約への同意** — `Y`
3. **EFFからのお知らせメール** — `N` でよい
4. **HTTP→HTTPSリダイレクト** — 聞かれた場合は `2: Redirect` を選択（最近のバージョンは自動でリダイレクト設定される）

成功すると `Successfully deployed certificate` と表示され、`/etc/nginx/sites-available/work-hub` に以下が自動追記される：

- `listen 443 ssl` のserverブロック（証明書ファイルのパス付き）
- ポート80 → 443 へのリダイレクト設定

証明書ファイルの保存先は `/etc/letsencrypt/live/work-hub.arumako-matsumoto.com/`。

### 14-5. 自動更新の確認

```bash
sudo systemctl list-timers | grep certbot
```
certbot はインストール時に自動更新タイマー（1日2回チェック、期限30日前に更新実行）を登録する。`certbot.timer` が表示されればOK。

```bash
sudo certbot renew --dry-run
```
更新処理のリハーサル。`Congratulations, all simulated renewals succeeded` と表示されれば、90日ごとの証明書更新は全自動で行われる。

### 14-6. 動作確認

ブラウザで以下を確認：

- `https://work-hub.arumako-matsumoto.com` — Basic認証 → アプリが表示され、アドレスバーに鍵マークが出る
- `http://work-hub.arumako-matsumoto.com` — 自動的に `https://` へリダイレクトされる

コマンドでの確認：
```bash
curl -I http://work-hub.arumako-matsumoto.com
```
`301 Moved Permanently` と `Location: https://...` が返ればリダイレクトOK。

### 14-7. ログイン機能（Google OAuth）デプロイ時の追加設定

`feature/login` ブランチをデプロイする際は、HTTPS化に伴い以下も必要：

**① VPSの `/opt/work-hub/.env` に追記：**
```bash
BETTER_AUTH_URL=https://work-hub.arumako-matsumoto.com
BETTER_AUTH_SECRET=<ランダム文字列。openssl rand -base64 32 で生成>
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
ALLOWED_EMAIL_DOMAIN=arumako.com
```
- `BETTER_AUTH_URL` はOAuthのリダイレクトURI組み立てとCookieの基準になるため、必ず `https://` のドメインを設定する（`http://` やIPのままだとログインが失敗する）

**② Google Cloud Console（APIとサービス → 認証情報 → OAuthクライアント）に本番URLを追加：**

- 承認済みのJavaScript生成元： `https://work-hub.arumako-matsumoto.com`
- 承認済みのリダイレクトURI： `https://work-hub.arumako-matsumoto.com/api/auth/callback/google`

詳細は `apps/web/docs/google-oauth-setup.md` を参照。

**③ アプリの再起動：**
```bash
pm2 restart work-hub
```

> 補足: 以前は `.env` の読み込みが起動ディレクトリ依存（`cwd/../../.env` 固定）で、pm2 を `/opt/work-hub` から起動すると `/opt/work-hub/.env` が読まれなかった。`apps/web/src/server/env.ts` を修正し、モノレポroot直下の `.env` も探索するようにした（2026-06-13）。

---

## 再デプロイ手順（コード更新時）

ローカルで変更をコミット・プッシュした後、VPSで以下を実行：

```bash
cd /opt/work-hub
git pull
npm install
npm run build
pm2 restart work-hub
```

---

## TODO

### APIルート（`/api/reports`）の本番対応
- 現在、`/api/reports`のAPIルートは`vite.config.ts`の`configureServer`で定義されている
- `configureServer`はViteの開発サーバー専用の機能であり、本番ビルドでは動作しない
- 本番環境でAPIルートが機能するよう、TanStack Startのサーバー機能または`serve.mjs`内でAPIルートを実装する必要がある

### ~~SSL化~~ → 手順14として追加済み
- ドメイン `work-hub.arumako-matsumoto.com` 取得済み。手順14（Let's Encrypt によるSSL化）を参照

### Docker化（将来的な移行）
- 現在は直接インストール構成
- Dockerfile + docker-compose.yml（本番用）を作成すれば移行可能
- DBデータは`pg_dump`でエクスポート → Dockerコンテナにインポート
