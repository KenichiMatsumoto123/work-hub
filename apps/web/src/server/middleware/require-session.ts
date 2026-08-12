/**
 * サーバ関数にログインを要求するミドルウェア
 *
 * ルートの beforeLoad（__root.tsx）で行うリダイレクトは画面遷移のための判定でしかなく、
 * サーバ関数のエンドポイントを直接叩かれた場合には効かない。
 * データを読み書きするサーバ関数はこのミドルウェアを通し、
 * セッションが無ければ 401 を返してデータに触らせない。
 */
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '../auth/auth'

export const requireSession = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await auth.api.getSession({ headers: getRequest().headers })

    if (!session) {
      // throw した Response はそのままクライアントへ返る
      throw new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    }

    return next({ context: { user: session.user } })
  },
)
