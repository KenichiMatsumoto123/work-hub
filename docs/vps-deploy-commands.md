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
cat > .env <<'EOF'
DATABASE_URL=postgresql://workhub:ab958533@localhost:5432/workhub
BETTER_AUTH_SECRET=<openssl rand -base64 32 の出力>
BETTER_AUTH_URL=https://<公開URL>
GOOGLE_CLIENT_ID=<GCPで発行したクライアントID>
GOOGLE_CLIENT_SECRET=<GCPで発行したクライアントシークレット>
AUTH_ALLOWED_EMAILS=<ログインを許可するメールアドレス（カンマ区切り）>
EOF
```
アプリがDBに接続するための接続文字列と、ログイン（Google OAuth）の設定を`.env`に保存する。
DBのパスワードは`CREATE USER`で設定したものと一致させる必要がある。

`BETTER_AUTH_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` は本番起動時に必須で、
未設定だと起動時にエラーになる（誤設定のまま動いてログイン画面だけ壊れる状態を避けるため）。
Google 側のクライアント発行手順は [google-oauth.md](./google-oauth.md) を参照。

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

## トラブルシューティング

### 日報の保存で「保存エラー」`password authentication failed for user "workhub"`

アプリが `.env` を読めず、開発用の既定接続先（パスワード `workhub_dev`）で接続しようとすると発生する。

確認：
```bash
cat /opt/work-hub/.env          # DATABASE_URL の行があるか
pm2 logs work-hub --lines 50    # 接続先の警告・エラーが出ていないか
```

`.env` が無い場合は再作成して再起動する：
```bash
cd /opt/work-hub
echo 'DATABASE_URL=postgresql://workhub:ab958533@localhost:5432/workhub' > .env
pm2 restart work-hub
```

`.env` はGitの管理対象外（`.gitignore`）のため、`git pull` では復元されない。VPSを作り直したり別ディレクトリへ再配置した場合は手動で作成すること。

パスワード自体が合っていない場合は、DBユーザーのパスワードを`.env`の値に合わせる：
```bash
sudo -u postgres psql -c "ALTER USER workhub WITH PASSWORD 'ab958533';"
pm2 restart work-hub
```

なお、`.env` の探索は起動ディレクトリから親方向へ遡って行われるため、`pm2 start apps/web/serve.mjs` をリポジトリ直下で実行しても `npm run start` でも同じ `.env` が読まれる。本番（`serve.mjs` 起動）では `DATABASE_URL` を解決できない場合、開発用の接続先にフォールバックせず起動時にエラーとなる。

`drizzle-kit`（マイグレーション）も同じ解決処理を使うため、環境変数を export していなくても `.env` があれば実行できる。

---

## TODO

### APIルート（`/api/reports`）の本番対応
- 現在、`/api/reports`のAPIルートは`vite.config.ts`の`configureServer`で定義されている
- `configureServer`はViteの開発サーバー専用の機能であり、本番ビルドでは動作しない
- 本番環境でAPIルートが機能するよう、TanStack Startのサーバー機能または`serve.mjs`内でAPIルートを実装する必要がある

### SSL化
- 独自ドメインを取得後、Let's Encrypt（certbot）で無料SSL証明書を発行
- NginxにHTTPS設定を追加（ポート443）
- さくらVPSのパケットフィルターでポート443を許可

### Docker化（将来的な移行）
- 現在は直接インストール構成
- Dockerfile + docker-compose.yml（本番用）を作成すれば移行可能
- DBデータは`pg_dump`でエクスポート → Dockerコンテナにインポート
