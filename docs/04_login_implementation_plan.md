# ログイン機能 実装計画書（better-auth + Google OAuth）

| 項目 | 内容 |
|------|------|
| 作成日 | 2026-05-30 |
| 対象 | work-hub（apps/web） |
| 前提設計書 | `docs/03_login_design.md`（レビュー反映済み） |
| ステータス | 実装着手用 |

本書は `docs/03_login_design.md` の決定事項を、**依存関係順のフェーズ**に分解した実装手順書である。各フェーズは「対象ファイル / 作業内容（コード骨子）/ 受け入れ基準」を持ち、上から順に実装・検証できる粒度で記述する。

---

## 0. 事前確認（context7 で裏取り済みの技術事実）

設計書 §6 で「実装時に確認」とした項目を確定した。

| 項目 | 確定事項 |
|------|----------|
| auth ハンドラのマウント | `createFileRoute('/api/auth/$')({ server: { handlers: { GET, POST } } })` で `auth.handler(request)` を返す（設計書通り） |
| サーバ側セッション取得 | **`getRequestHeaders()`（`@tanstack/react-start/server`）＋ `auth.api.getSession({ headers })`**。`getWebRequest` ではなくこちらを使う |
| ドメイン制限 | `databaseHooks.user.create.before` 内で **`APIError('BAD_REQUEST', { message })`**（`better-auth/api`）を throw。プレーン `Error` は使わない |
| uuid id | `advanced.database.generateId: () => crypto.randomUUID()` で全 auth テーブルの id を uuid 文字列で生成。Drizzle 側カラムは `uuid('id')`（`defaultRandom()` は付けず better-auth 生成値を使用） |
| セッション設定 | `session: { expiresIn, updateAge }` で 30日 / 1日 |
| Server Function 保護 | TanStack Start の `createMiddleware`（`@tanstack/react-start`）で `authMiddleware` を定義し `.middleware([authMiddleware])` で付与。内部で `getRequestHeaders()`＋`auth.api.getSession()` |

> ドメイン制限について：better-auth + social では `databaseHooks.user.create.before` は**ユーザー作成（初回サインイン）時**に発火する。静的な許可ドメイン＋同意画面 Internal（Google 側で組織外を遮断）の二段構えで「毎回サーバ側で許可外を弾く」要件を満たす。返却済みユーザーの再検証はドメインが静的なため不要。

### インストールするパッケージ（`apps/web`）

```
npm -w apps/web install better-auth
# CLI（スキーマ雛形生成・dev依存）
npm -w apps/web install -D @better-auth/cli
```

---

## 1. 全体方針と依存順

```
Phase 0  外部準備（Google Cloud / 環境変数）          ← 他作業と並行可
Phase 1  DBスキーマ（auth 4テーブル + daily_reports 改修）
Phase 2  better-auth コア（server/auth.ts）
Phase 3  API ルート + auth-client
Phase 4  認証ミドルウェア + Server Function 保護 + userId スコープ
Phase 5  画面（login + _authed レイアウト + ルート移動 + ナビ）
Phase 6  検証（自動E2E + 手動）
```

依存理由：スキーマ（1）が無いと auth（2）が動かない。auth（2）が無いと API/クライアント（3）・ミドルウェア（4）が組めない。ミドルウェア（4）が `context.user.id` を提供して初めて userId スコープが入る。画面（5）はサーバ側 `fetchSession` を前提とするため auth（2-3）の後。検証（6）は全体結合後。

各フェーズ末尾でコミットする（`/commit` 規約：1機能1コミット）。

---

## Phase 0. 外部準備（ユーザー作業 + 環境変数）

### 0.1 Google Cloud Console（ユーザー作業）
1. OAuth 同意画面を作成し **User type = Internal（内部）** を選択（arumako.co.jp Workspace 限定）。
2. 認証情報 → OAuth 2.0 クライアント ID（ウェブアプリケーション）を作成。
3. 承認済みリダイレクト URI に登録：
   - `http://localhost:3000/api/auth/callback/google`（開発）
   - `https://<本番ドメイン>/api/auth/callback/google`（本番）
4. 発行された Client ID / Client Secret を控える。

### 0.2 環境変数（モノレポ root `.env`）
既存 `apps/web/src/server/db.ts` が root `../../.env` を読む方式に合わせ、root `.env` に追記。

```
BETTER_AUTH_SECRET=<openssl rand -base64 32 等で生成した32文字以上>
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<0.1で発行>
GOOGLE_CLIENT_SECRET=<0.1で発行>
ALLOWED_EMAIL_DOMAIN=arumako.co.jp
```

- `.env.example` にも同じキー（値は空）を追記。
- **環境変数ロードの確認**：`auth.ts` は `process.env.*` で参照する。`db.ts` 同様、root `.env` が server 実行時に `process.env` へ載るか確認し、載らない場合は `db.ts` のロード処理を共通化したヘルパー（例 `server/env.ts`）を作って `auth.ts` から呼ぶ。
- **drizzle-kit 用**：`drizzle.config.ts` は `process.env.DATABASE_URL` を直接参照する。`db:push` 実行時にシェル env に `DATABASE_URL` がある状態にする（既存 `db:setup` フローを踏襲）。

**受け入れ基準**：Google クライアント作成済み、root `.env`/`.env.example` に5キー追加済み。

---

## Phase 1. DBスキーマ

### 1.1 auth 4テーブル（`apps/web/src/server/schema/auth.ts`）★新規
1. CLI で雛形生成：`npx @better-auth/cli generate`（または手書き）。
2. 既存規約に合わせ調整：
   - id を `uuid('id').primaryKey()`（`defaultRandom()` は付けない＝better-auth の `generateId` が供給）。
   - `created_at`/`updated_at` を `timestamp({ withTimezone: true })`。
   - カラムは snake_case。
3. テーブル：`users` / `accounts` / `sessions` / `verifications`（OAuthのみでも4つ必要）。

```ts
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
// sessions / accounts / verifications も同様（CLI 雛形を uuid・timestamptz に調整）
```

### 1.2 `daily_reports` のユーザースコープ化（`apps/web/src/server/schema/reports.ts`）★改修
```ts
import { users } from './auth'
import { unique } from 'drizzle-orm/pg-core'

export const dailyReports = pgTable('daily_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  date: date('date').notNull(),            // ← .unique() を外す
  // ... 既存カラムはそのまま ...
}, (t) => ({
  userDateUnique: unique('daily_reports_user_id_date_unique').on(t.userId, t.date),
}))
```

### 1.3 schema index（`apps/web/src/server/schema/index.ts`）★改修
```ts
export * from './auth'   // ← 追記
```

### 1.4 マイグレーション反映
1. `npm run db:up`（DB 起動）。
2. **既存 `daily_reports` を truncate**（破棄合意済み）。`npm run db:studio` か psql で `TRUNCATE TABLE daily_reports;`。
   - もしくは `db:push` が `user_id NOT NULL` 追加で失敗する場合に備え、push 前に truncate しておく。
3. `npm run db:generate` → `npm run db:push`。

**受け入れ基準**：`users/accounts/sessions/verifications` と `user_id` 付き `daily_reports`（`unique(user_id,date)`）が DB に作成される。

---

## Phase 2. better-auth コア（`apps/web/src/server/auth.ts`）★新規

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { db } from './db'
import * as schema from './schema'

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? 'arumako.co.jp'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: false },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30日
    updateAge: 60 * 60 * 24,      // 1日
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(), // 全 auth テーブル uuid
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!user.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
            throw new APIError('BAD_REQUEST', {
              message: 'このドメインのアカウントは利用できません',
            })
          }
          return { data: user }
        },
      },
    },
  },
})
```

**受け入れ基準**：型エラー無くビルドが通る。`auth.api.getSession` 等が import 可能。許可外ドメイン時に `APIError` で拒否される設計になっている（実挙動は Phase 6 手動確認）。

> 確認点：`drizzleAdapter` の `schema` マッピングで better-auth が期待するモデル名（user/session/account/verification）と Drizzle のエクスポート名が対応するか。ズレる場合は `drizzleAdapter(db, { provider: 'pg', schema, usePlural: true })` 等のオプション、または `modelName` 指定で調整。

---

## Phase 3. API ルート + auth-client + セッション取得関数

### 3.1 API ルート（`apps/web/src/routes/api/auth/$.ts`）★新規
```ts
import { auth } from '~/server/auth'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET:  async ({ request }: { request: Request }) => auth.handler(request),
      POST: async ({ request }: { request: Request }) => auth.handler(request),
    },
  },
})
```

### 3.2 auth-client（`apps/web/src/lib/auth-client.ts`）★新規
```ts
import { createAuthClient } from 'better-auth/react'
export const authClient = createAuthClient()
export const { signIn, signOut, useSession } = authClient
```

### 3.3 サーバ側セッション取得（`apps/web/src/server/auth-session.ts`）★新規
beforeLoad から呼ぶ `createServerFn`。クライアント遷移時も Cookie をサーバ側で読む。
```ts
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from './auth'

export const fetchSession = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  return session // { user, session } | null
})
```

**受け入れ基準**：`/api/auth/reference` 等のハンドラが 200 応答（`npm run dev` で `curl http://localhost:3000/api/auth/ok` 等）。`fetchSession()` が null を返す（未ログイン時）。

---

## Phase 4. 認証ミドルウェア + Server Function 保護 + userId スコープ

### 4.1 authMiddleware（`apps/web/src/server/auth-middleware.ts`）★新規
```ts
import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
import { auth } from './auth'

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw redirect({ to: '/login' })
  }
  return next({ context: { user: session.user } })
})
```
> `createMiddleware` のシグネチャ（`{ type: 'function' }` 指定要否、`.server()` の引数形）は当該バージョンで確認。要旨は「セッション検証→未認証は redirect→`context.user` 注入」。

### 4.2 reports Server Function 改修（`apps/web/src/server/functions/reports.ts`）★改修
全関数に `.middleware([authMiddleware])` を付与し、`context.user.id` で userId スコープを適用。**クライアントから userId は受け取らない。**

```ts
import { authMiddleware } from '../auth-middleware'

export const getReportsByMonthFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { year: number; month: number }) => data)
  .handler(async ({ data, context }) => {
    const rows = await db.select().from(dailyReports).where(
      and(
        eq(dailyReports.userId, context.user.id),     // ← スコープ
        gte(dailyReports.date, startDate),
        lt(dailyReports.date, endDate),
      ),
    ).orderBy(dailyReports.date)
    return rows.map(rowToReport)
  })

export const saveReportFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: DailyReportData) => data)
  .handler(async ({ data, context }) => {
    await db.insert(dailyReports)
      .values({ userId: context.user.id, /* ...既存... */ })
      .onConflictDoUpdate({
        target: [dailyReports.userId, dailyReports.date], // ← 複合キー
        set: { /* ...既存... */ updatedAt: new Date() },
      })
    return { success: true }
  })
```

- `getAllReportsFn` / `deleteReportFn` も同様に `authMiddleware` 付与＋`eq(dailyReports.userId, context.user.id)` 追加。`deleteReportFn` の `where` は `and(eq(userId), eq(date))`。
- `lib/storage.ts` は呼び出し側のため変更不要（userId はサーバ側で付与）。

**受け入れ基準**：未認証で `saveReportFn` を直接呼ぶと `/login` リダイレクト相当の応答。ログイン状態では自分のデータのみ読み書きできる（Phase 6 で検証）。

---

## Phase 5. 画面（login + _authed レイアウト + ルート移動）

### 5.1 ログイン画面（`apps/web/src/routes/login.tsx`）★新規
- 中央寄せ、「Googleでログイン」ボタン1つ（`~/components/ui/Button` 流用）。
- クリックで `signIn.social({ provider: 'google', callbackURL: '/' })`。
- `beforeLoad` で `fetchSession()` し、**既ログインなら `/` へ redirect**。
- URL クエリ（例 `?error=...`）でドメイン拒否エラーを表示。

### 5.2 ルート context にセッションを載せる（`apps/web/src/routes/__root.tsx`）★改修
```ts
export const Route = createRootRoute({
  beforeLoad: async () => {
    const session = await fetchSession()
    return { session } // 子ルートの context.session で参照
  },
  // head/component は既存
})
```
ナビバーの固定3リンクは `__root` から **`_authed` レイアウトへ移設**（5.4）。`__root` は html/Scripts と context 提供に専念。

### 5.3 ルート移動（`routes/` → `routes/_authed/`）★移動
- `index.tsx` → `_authed/index.tsx`
- `timesheet.tsx` → `_authed/timesheet.tsx`
- `attendance.tsx` → `_authed/attendance.tsx`
- 移動後 `routeTree.gen.ts` は dev/build 時に自動再生成される（手動編集不要）。`~` エイリアス import はパス不変なので影響軽微だが、相対 import があれば修正。

### 5.4 _authed レイアウト（`apps/web/src/routes/_authed/route.tsx`）★新規
```ts
import { createFileRoute, redirect, Outlet, Link } from '@tanstack/react-router'
import { signOut, useSession } from '~/lib/auth-client'

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: '/login' })
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  // ナビバー（既存3リンク）＋ ユーザー名 ＋ ログアウト（signOut → /login）
  // <Outlet />
}
```

**受け入れ基準**：未ログインで `/`・`/timesheet`・`/attendance` → `/login` へ。ログイン後はナビにユーザー名・ログアウト表示。`/login` は既ログイン時 `/` へ。

---

## Phase 6. 検証

### 6.1 自動 E2E（Playwright、Google 不要・シードセッション）
1. テスト用ユーザー行と `sessions` 行を DB に直接 INSERT し、セッション Cookie をブラウザにセット。
2. ケース：
   - 未ログインで保護3ルート → `/login` リダイレクト。
   - シードセッションで保護ルート描画＋ナビにユーザー名。
   - `saveReportFn`/`getReportsByMonthFn` が動作し、**別ユーザーの user_id では当該データが見えない**。
   - 同一 `date` を別 user_id で保存しても衝突しない（共存）。
   - ログアウト → `/login`、保護ルート再アクセス不可。
3. `npm run test:e2e`。

### 6.2 手動
- 許可ドメイン実 Google アカウントでログイン → `/` 遷移・ユーザー名表示。
- 許可外ドメイン → 拒否・エラー表示・セッション未発行（Cookie 残らない）。

**受け入れ基準**：6.1 自動グリーン、6.2 手動 OK。

---

## 7. 本番（VPS）反映メモ

- root `.env`（本番）に `BETTER_AUTH_URL=https://<本番ドメイン>`、Google クライアントの本番リダイレクト URI を設定。
- `BETTER_AUTH_SECRET` は本番専用のランダム値。
- 本番 DB でも `daily_reports` truncate ＋ `db:push` を実施（破棄合意済み。本番に保全すべき日報が無いことを反映直前に再確認）。
- VPS デプロイ手順書（`apps/web/docs/` 配下のデプロイ文書）へ上記を追記。

---

## 8. リスクと対策

| リスク | 対策 |
|--------|------|
| `createMiddleware` / `getRequestHeaders` の API がバージョン差異 | Phase 3-4 着手時に最小実装で疎通確認してから全関数展開 |
| drizzleAdapter のモデル名マッピングずれ | `usePlural`/`modelName`/`schema` 明示で調整。CLI 生成スキーマを正とする |
| uuid id 生成と Drizzle `uuid` カラムの整合 | `generateId: () => crypto.randomUUID()`＋カラム `uuid('id')`（defaultRandom 無し）で一致 |
| root `.env` が server 実行時に未ロード | `db.ts` のロード処理を `server/env.ts` に切り出し `auth.ts` でも使用 |
| ルート移動で routeTree 再生成漏れ | dev サーバ再起動で再生成。型エラーが出たら import パス確認 |
| 同意画面 Internal 設定漏れで外部アカウント通過 | サーバ側 `databaseHooks` 検証が最終防壁として機能（二重化） |

---

## 9. 完了チェックリスト

- [ ] Phase 0: Google クライアント作成・`.env`/`.env.example` 更新
- [ ] Phase 1: auth 4テーブル＋`daily_reports`（user_id, unique(user_id,date)）反映
- [ ] Phase 2: `server/auth.ts`（domain hook・session・uuid）
- [ ] Phase 3: `api/auth/$.ts`・`auth-client.ts`・`fetchSession`
- [ ] Phase 4: `authMiddleware`＋reports 全関数の保護＆userId スコープ
- [ ] Phase 5: `login.tsx`・`_authed/route.tsx`・3ルート移動・`__root` context
- [ ] Phase 6: 自動E2E グリーン・手動確認 OK
- [ ] 各フェーズ末でコミット（1機能1コミット）
