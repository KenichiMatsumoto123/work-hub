/**
 * ログインを許可するメールアドレスの判定
 *
 * Google アカウントは誰でも作れるため、OAuth を通っただけでは「このアプリを使ってよい人」に
 * ならない。許可リスト（環境変数 AUTH_ALLOWED_EMAILS）を通ったアドレスだけをログインさせる。
 *
 * 未設定の場合は「制限なし（Google アカウントであれば誰でもログインできる）」として扱う。
 * 個人利用でいきなり閉め出されないための既定値であり、公開環境では必ず設定すること
 * （resolveAuthConfig が本番で未設定の場合に警告する）。
 */

/** 許可リストのエントリ。メールアドレス（`me@example.com`）かドメイン（`@example.com`）。 */
export type AllowlistEntry = string

/** メールアドレスの比較用正規化（前後空白の除去と小文字化） */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * 環境変数の値を許可リストへ変換する。
 * 区切りはカンマ・空白・改行のいずれでもよい。未設定・空文字の場合は null（＝制限なし）。
 */
export function parseAllowedEmails(
  raw: string | undefined | null,
): AllowlistEntry[] | null {
  if (raw == null) return null

  const entries = raw
    .split(/[\s,]+/)
    .map(normalizeEmail)
    .filter((entry) => entry.length > 0)

  if (entries.length === 0) return null

  return [...new Set(entries)]
}

/**
 * メールアドレスがログインを許可されているか判定する。
 * allowed が null（未設定）の場合は制限なしとして true を返す。
 */
export function isEmailAllowed(
  email: string | null | undefined,
  allowed: AllowlistEntry[] | null,
): boolean {
  if (allowed === null) return true
  if (!email) return false

  const normalized = normalizeEmail(email)
  const atIndex = normalized.lastIndexOf('@')
  if (atIndex <= 0 || atIndex === normalized.length - 1) return false

  const domain = normalized.slice(atIndex) // '@example.com'

  return allowed.some((entry) =>
    entry.startsWith('@') ? entry === domain : entry === normalized,
  )
}
