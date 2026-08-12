/**
 * E2E 用のログイン状態を用意する（Playwright の setup プロジェクト）
 *
 * Google のログイン画面は自動化せず、テスト用ユーザーのセッションを直接発行して
 * ログイン済みのクッキー（storageState）を作る。
 *
 * クッキーの署名は better-auth 本体に任せる（test-utils プラグインの `ctx.test.login`）。
 * 自前で署名を組み立てると better-auth 側の実装変更でずれるため。
 * このセットアップ専用の better-auth インスタンスは e2e/ に閉じており、
 * 本番の src/server/auth/auth.ts には手を入れない。
 *
 * 前提: テスト用DBが起動していること。開発サーバ（Playwright の webServer が起動）と
 * 同じ BETTER_AUTH_SECRET を使うため、署名がそのまま検証できる。
 */
import { test as setup } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { testUtils } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { db } from '../src/server/db'
import * as schema from '../src/server/schema'
import { resolveAuthConfig } from '../src/server/auth/config'
import { E2E_USERS, type E2EUser } from './fixtures/e2e-user'

/**
 * セットアップ専用インスタンス。secret は開発サーバと同じ解決方法で取り出す。
 * databaseHooks（許可リスト照合）は付けない：ここは OAuth の代わりに
 * セッションを直接発行する経路であり、許可リストの検証は結合テスト側で行う。
 */
const setupAuth = betterAuth({
  secret: resolveAuthConfig().secret,
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  plugins: [testUtils()],
})

/** シードユーザーを冪等に用意する */
async function ensureUser(user: E2EUser): Promise<string> {
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, user.email))
    .limit(1)
  if (existing) return existing.id

  const ctx = await setupAuth.$context
  const created = ctx.test.createUser({
    email: user.email,
    name: user.name,
    emailVerified: true,
  })
  const saved = await ctx.test.saveUser(created)
  return saved.id
}

for (const user of E2E_USERS) {
  setup(`${user.email} のセッションを発行する`, async ({ context }) => {
    const userId = await ensureUser(user)

    const ctx = await setupAuth.$context
    const { cookies } = await ctx.test.login({ userId })

    await context.addCookies(cookies)
    await context.storageState({ path: user.storageState })
  })
}
