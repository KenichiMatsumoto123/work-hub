/**
 * 認証まわりの設定解決（BETTER_AUTH_SECRET / Google OAuth クライアント / 許可リスト）
 *
 * DATABASE_URL と同じく、環境変数 → 親ディレクトリを遡って見つけた .env の順に解決する
 * （起動方法によって cwd が変わるため。詳細は env.ts を参照）。
 *
 * 本番（NODE_ENV=production）では未設定を黙って握りつぶさず例外を投げる。
 * 空のクライアントIDで OAuth を開始すると Google 側で「invalid_client」とだけ表示され、
 * 原因が分かりにくいため、設定不足の時点で失敗させる。
 */
import { describeEnvLookup, lookupEnvValue, resolveEnvValue } from '../env'
import { parseAllowedEmails, type AllowlistEntry } from './allowlist'

/** BETTER_AUTH_SECRET 未設定時の開発用フォールバック（本番では使わない） */
export const DEV_FALLBACK_AUTH_SECRET =
  'dev-only-auth-secret-change-me-in-production'

export type AuthConfig = {
  /** アプリのベースURL。未設定ならリクエストのホストから better-auth が推定する */
  baseURL: string | undefined
  /** セッションクッキーの署名に使うシークレット */
  secret: string
  /** Google OAuth クライアント */
  google: {
    clientId: string
    clientSecret: string
  }
  /** ログインを許可するメール／ドメイン。null なら制限なし */
  allowedEmails: AllowlistEntry[] | null
}

/** 本番で必須の環境変数を解決する。未設定なら原因の分かるメッセージで throw する */
function requireEnvValue(
  key: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): string | undefined {
  const lookup = lookupEnvValue(key, env, cwd)
  if (lookup.value) return lookup.value

  if (env.NODE_ENV === 'production') {
    throw new Error(
      `${key} を解決できませんでした（${describeEnvLookup(key, lookup)}）。` +
        `環境変数 ${key} を設定するか、アプリのルートの .env に記述してください。`,
    )
  }

  return undefined
}

/**
 * 認証設定を解決する。
 * 本番で BETTER_AUTH_SECRET / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が無ければ例外を投げる。
 * 開発時は警告のうえフォールバック（Google ログインは実際には動かないが、
 * DB 操作やページ表示の確認はできる状態で起動する）。
 */
export function resolveAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): AuthConfig {
  const isProduction = env.NODE_ENV === 'production'

  const secret = requireEnvValue('BETTER_AUTH_SECRET', env, cwd)
  const clientId = requireEnvValue('GOOGLE_CLIENT_ID', env, cwd)
  const clientSecret = requireEnvValue('GOOGLE_CLIENT_SECRET', env, cwd)

  if (!secret) {
    console.warn(
      '[auth] BETTER_AUTH_SECRET が未設定のため開発用の固定シークレットを使用します',
    )
  }
  if (!clientId || !clientSecret) {
    console.warn(
      '[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定のため Google ログインは失敗します',
    )
  }

  const allowedEmails = parseAllowedEmails(
    resolveEnvValue('AUTH_ALLOWED_EMAILS', env, cwd),
  )
  if (allowedEmails === null && isProduction) {
    console.warn(
      '[auth] AUTH_ALLOWED_EMAILS が未設定です。Google アカウントを持つ誰でもログインできます',
    )
  }

  return {
    baseURL: resolveEnvValue('BETTER_AUTH_URL', env, cwd),
    secret: secret ?? DEV_FALLBACK_AUTH_SECRET,
    google: {
      clientId: clientId ?? '',
      clientSecret: clientSecret ?? '',
    },
    allowedEmails,
  }
}
