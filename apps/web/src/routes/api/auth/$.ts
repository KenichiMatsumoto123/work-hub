import { createFileRoute } from '@tanstack/react-router'
import { auth } from '~/server/auth'

/**
 * better-auth ハンドラを catch-all サーバルートにマウントする。
 * /api/auth/* への GET/POST をすべて better-auth に委譲する。
 */
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
})
