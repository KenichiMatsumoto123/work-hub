import './env'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { db } from './db'
import { users, sessions, accounts, verifications } from './schema/auth'

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? 'arumako.com'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    // better-auth のモデル名（単数）を Drizzle テーブルへ明示マッピング。
    // export 名・テーブル名が複数形でもズレないようにする。
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: { enabled: false },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30日
    updateAge: 60 * 60 * 24, // 1日ごとにローリング更新
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
  advanced: {
    database: {
      // 全 auth テーブルの id を uuid 文字列で生成（Drizzle 側は uuid カラム）
      generateId: () => crypto.randomUUID(),
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // 許可ドメイン外のメールは初回ユーザー作成時にサーバ側で拒否する。
          // セッションは発行されない（残留 Cookie が出ない）。
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
