/**
 * ログイン前後のリダイレクト先の扱い
 *
 * 未ログインで保護ページを開いたときは、ログイン後に元のページへ戻せるよう
 * `/login?redirect=<元のパス>` の形で持ち回る。
 * この値は URL 経由＝外部から差し込める入力なので、そのまま遷移先にはしない
 * （`https://evil.example` などを渡されるとログイン直後に外部サイトへ飛ばされてしまう）。
 */

/** ログイン後の既定の遷移先 */
export const DEFAULT_POST_LOGIN_PATH = '/'

/** ログイン不要でアクセスできるパス */
const PUBLIC_PATHS = ['/login']

/** 認証チェックを行わないパスか（ログイン画面と better-auth のエンドポイント） */
export function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/api/auth')) return true
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

/**
 * ログイン後の遷移先を決める。
 * 同一サイト内の絶対パス（`/timesheet` 等）だけを許可し、それ以外は既定のパスに落とす。
 */
export function resolvePostLoginPath(
  redirect: string | undefined | null,
): string {
  if (!redirect) return DEFAULT_POST_LOGIN_PATH

  // `//evil.example` や `/\evil.example` はブラウザにプロトコル相対URLとして解釈される
  if (!redirect.startsWith('/')) return DEFAULT_POST_LOGIN_PATH
  if (redirect.startsWith('//') || redirect.startsWith('/\\')) {
    return DEFAULT_POST_LOGIN_PATH
  }
  // 制御文字（改行・タブ等）を含む値はブラウザ・サーバ間で解釈がぶれるため弾く
  if (/[\u0000-\u001f\u007f]/.test(redirect)) return DEFAULT_POST_LOGIN_PATH

  // ログイン画面へ戻すとループするため既定のパスに落とす
  if (isPublicPath(redirect.split('?')[0])) return DEFAULT_POST_LOGIN_PATH

  return redirect
}
