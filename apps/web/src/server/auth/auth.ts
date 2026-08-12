/**
 * better-auth のサーバ設定（Google OAuth によるログイン）
 *
 * - DB は既存の drizzle インスタンスをそのまま使う（schema/auth.ts の user/session/account/verification）。
 * - 許可リスト（AUTH_ALLOWED_EMAILS）の照合は databaseHooks で行い、OAuth を通っただけでは
 *   ログインさせない。初回ログイン（user 作成前）と毎回のログイン（session 作成前）の両方で照合し、
 *   許可リストから外したユーザーが既存セッション更新後もログインし続けられないようにする。
 * - クッキーの発行は tanstackStartCookies() が TanStack Start のレスポンスへ反映する。
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../schema'
import { isEmailAllowed } from './allowlist'
import { resolveAuthConfig } from './config'

const config = resolveAuthConfig()

/** ログイン拒否のエラーコード。ログイン画面はこの値を見て理由を表示する */
export const SIGN_IN_NOT_ALLOWED = 'email_not_allowed'

/** 許可リストに無いメールアドレスのログインを拒否する（403 → /login?error=... へ戻る） */
function rejectSignIn(email: string | null | undefined): never {
  throw new APIError('FORBIDDEN', {
    code: SIGN_IN_NOT_ALLOWED.toUpperCase(),
    message: `このメールアドレスはログインを許可されていません: ${email ?? '(不明)'}`,
  })
}

/** userId から現在のメールアドレスを引く（session 作成前の再照合用） */
async function findUserEmail(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  return row?.email ?? null
}

export const auth = betterAuth({
  baseURL: config.baseURL,
  secret: config.secret,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    // schema のエクスポート名が複数形（users/sessions/...）であることを伝える
    usePlural: true,
  }),
  socialProviders: {
    google: {
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // 初回ログイン：未許可なら user 行を作らずに拒否する
        before: async (user) => {
          if (!isEmailAllowed(user.email, config.allowedEmails)) {
            rejectSignIn(user.email)
          }
        },
      },
    },
    session: {
      create: {
        // 2回目以降のログイン：許可リストから外れていればセッションを作らせない
        before: async (session) => {
          const email = await findUserEmail(session.userId)
          if (!isEmailAllowed(email, config.allowedEmails)) {
            rejectSignIn(email)
          }
        },
      },
    },
  },
  plugins: [tanstackStartCookies()],
})
