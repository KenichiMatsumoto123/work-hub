/**
 * better-auth のブラウザ側クライアント
 *
 * baseURL は省略して現在のオリジン（/api/auth）を使う。
 */
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()

export const { signIn, signOut, useSession } = authClient
