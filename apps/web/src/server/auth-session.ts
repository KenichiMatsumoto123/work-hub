import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from './auth'

/**
 * サーバ側でセッションを取得する Server Function。
 *
 * beforeLoad（__root / login）から呼ぶ。クライアント遷移時も Cookie を
 * サーバ側で読むため、getRequestHeaders() のヘッダを better-auth に渡す。
 *
 * 戻り値: `{ user, session }` | null
 */
export const fetchSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const headers = getRequestHeaders() as unknown as Headers
    const session = await auth.api.getSession({ headers })
    return session
  },
)
