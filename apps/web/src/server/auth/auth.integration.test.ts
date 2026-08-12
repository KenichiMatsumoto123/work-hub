/**
 * better-auth と drizzle スキーマの結線を実DBに対して確認する結合テスト
 *
 * 単体テストでは「許可リストの判定」までしか担保できず、アダプタの設定ミス
 * （schema のエクスポート名とモデル名のずれ・カラム名の不一致など）は実行時まで表面化しない。
 * ここでは実DBに繋いだ better-auth インスタンスを直接叩き、
 * 1) user/session を実際に作成・取得できること、
 * 2) 許可リストの照合が初回ログイン（user 作成）と再ログイン（session 作成）で効くこと、
 * を確認する。Google の OAuth 画面自体は自動化対象外（better-auth 側の責務）。
 *
 * 実行には起動済みのテスト用DBが必要（npm run test:integration）。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../schema'
import { isEmailAllowed } from './allowlist'

const ALLOWED_EMAIL = 'allowed@example.com'
const ALLOWED_DOMAIN_EMAIL = 'someone@allowed-domain.example'
const DENIED_EMAIL = 'denied@example.com'
const TEST_EMAILS = [ALLOWED_EMAIL, ALLOWED_DOMAIN_EMAIL, DENIED_EMAIL]

/** 本番（auth.ts）と同じ結線のインスタンス。許可リストだけテスト用に固定する */
const allowedEmails = [ALLOWED_EMAIL, '@allowed-domain.example']

const testAuth = betterAuth({
  secret: 'integration-test-secret-integration-test-secret',
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isEmailAllowed(user.email, allowedEmails)) {
            throw new APIError('FORBIDDEN', { message: 'not allowed' })
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const [row] = await db
            .select({ email: schema.users.email })
            .from(schema.users)
            .where(eq(schema.users.id, session.userId))
            .limit(1)
          if (!isEmailAllowed(row?.email, allowedEmails)) {
            throw new APIError('FORBIDDEN', { message: 'not allowed' })
          }
        },
      },
    },
  },
})

async function cleanup() {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(inArray(schema.users.email, TEST_EMAILS))
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return

  await db.delete(schema.sessions).where(inArray(schema.sessions.userId, ids))
  await db.delete(schema.accounts).where(inArray(schema.accounts.userId, ids))
  await db.delete(schema.users).where(inArray(schema.users.id, ids))
}

/** better-auth の内部アダプタ（OAuth コールバックが user/session を作るのに使う経路） */
async function internalAdapter() {
  return (await testAuth.$context).internalAdapter
}

beforeEach(cleanup)
afterAll(cleanup)

describe('better-auth と drizzle スキーマの結線', () => {
  it('許可されたメールアドレスなら user を作成できる', async () => {
    const adapter = await internalAdapter()

    const created = await adapter.createUser({
      name: '許可ユーザー',
      email: ALLOWED_EMAIL,
      emailVerified: true,
    })

    expect(created.id).toBeTruthy()
    expect(created.email).toBe(ALLOWED_EMAIL)

    const [stored] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, ALLOWED_EMAIL))
    expect(stored).toBeDefined()
    expect(stored.emailVerified).toBe(true)
  })

  it('作成した user のセッションをトークンから引ける', async () => {
    const adapter = await internalAdapter()
    const user = await adapter.createUser({
      name: '許可ユーザー',
      email: ALLOWED_EMAIL,
      emailVerified: true,
    })

    const session = await adapter.createSession(user.id, undefined)
    expect(session.token).toBeTruthy()

    const found = await adapter.findSession(session.token)
    expect(found?.user.email).toBe(ALLOWED_EMAIL)
    expect(found?.session.userId).toBe(user.id)
  })

  it('ドメイン指定（@example）で許可されたメールアドレスも作成できる', async () => {
    const adapter = await internalAdapter()

    const created = await adapter.createUser({
      name: 'ドメイン許可ユーザー',
      email: ALLOWED_DOMAIN_EMAIL,
      emailVerified: true,
    })

    expect(created.email).toBe(ALLOWED_DOMAIN_EMAIL)
  })
})

describe('許可リストによるログイン拒否', () => {
  it('初回ログイン：許可されていないメールアドレスでは user 行を作らない', async () => {
    const adapter = await internalAdapter()

    await expect(
      adapter.createUser({
        name: '未許可ユーザー',
        email: DENIED_EMAIL,
        emailVerified: true,
      }),
    ).rejects.toThrow()

    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, DENIED_EMAIL))
    expect(rows).toHaveLength(0)
  })

  it('再ログイン：許可リストから外れた既存ユーザーはセッションを作れない', async () => {
    // 許可されている状態で作成した user を、後から許可リスト外のアドレスに変更する
    const adapter = await internalAdapter()
    const user = await adapter.createUser({
      name: '許可ユーザー',
      email: ALLOWED_EMAIL,
      emailVerified: true,
    })
    await db
      .update(schema.users)
      .set({ email: DENIED_EMAIL })
      .where(eq(schema.users.id, user.id))

    await expect(adapter.createSession(user.id, undefined)).rejects.toThrow()

    const sessions = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, user.id))
    expect(sessions).toHaveLength(0)
  })
})
