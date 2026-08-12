/**
 * better-auth のエンドポイント（/api/auth/*）
 *
 * サインイン開始・Google からのコールバック・セッション取得・サインアウトを全て better-auth に委ねる。
 * このファイルは server ハンドラのみを持つためクライアントバンドルには含まれない
 * （TanStack Start が server 専用ルートとしてクライアントのルートツリーから除外する）。
 */
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '~/server/auth/auth'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
})
