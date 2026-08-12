/**
 * ログイン状態を取得するサーバ関数
 *
 * ルートの beforeLoad（SSR・クライアント遷移の両方で走る）から呼び、
 * 未ログインなら /login へリダイレクトする判断に使う。
 */
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '../auth/auth'

/** 画面表示に使う最小限のユーザー情報（セッション本体はクライアントへ渡さない） */
export type SessionUser = {
  id: string
  name: string
  email: string
  image: string | null
}

export const getSessionUserFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    })
    if (!session) return null

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    }
  },
)
