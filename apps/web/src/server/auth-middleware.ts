import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
import { auth } from './auth'

/**
 * Server Function 保護ミドルウェア。
 *
 * createServerFn の RPC エンドポイントは画面ガードを迂回できるため、
 * これがセキュリティの実体。セッションを検証し、未認証なら /login へ
 * redirect、認証済みなら context.user / context.session を注入する。
 */
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders() as unknown as Headers
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw redirect({ to: '/login' })
  }
  return next({
    context: { user: session.user, session: session.session },
  })
})
