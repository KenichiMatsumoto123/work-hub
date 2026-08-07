import { createAuthClient } from 'better-auth/react'

/** クライアント側 better-auth。baseURL は同一オリジンを自動利用。 */
export const authClient = createAuthClient()

export const { signIn, signOut, useSession } = authClient
