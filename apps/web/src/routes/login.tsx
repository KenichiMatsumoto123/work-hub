import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '~/lib/auth-client'
import { resolvePostLoginPath } from '~/lib/auth-redirect'

/**
 * ログイン画面
 *
 * Google のログインボタンだけを置く。better-auth がログインを拒否した場合は
 * `?error=...` を付けてこの画面に戻ってくるので、その理由を表示する。
 */
export const Route = createFileRoute('/login')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect?: string; error?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    // ログイン済みならログイン画面に留まる意味がないので戻す
    if (context.sessionUser) {
      throw redirect({ to: resolvePostLoginPath(search.redirect) })
    }
  },
  component: LoginPage,
})

/** better-auth から返るエラーコードを日本語の理由に変換する */
function errorMessage(error: string): string {
  if (error.toLowerCase().includes('email_not_allowed')) {
    return 'このアカウントはログインを許可されていません。管理者に許可リストへの追加を依頼してください。'
  }
  return 'ログインに失敗しました。時間をおいて、もう一度お試しください。'
}

function LoginPage() {
  const { redirect: redirectTo, error } = Route.useSearch()
  const [submitting, setSubmitting] = useState(false)

  const handleGoogleSignIn = async () => {
    setSubmitting(true)
    const callbackURL = resolvePostLoginPath(redirectTo)
    const errorCallbackURL = `/login?error=sign_in_failed${
      redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : ''
    }`

    const { error: signInError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL,
      errorCallbackURL,
    })

    // リダイレクトまで到達しなかった場合だけボタンを戻す
    if (signInError) setSubmitting(false)
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8">
        <h1 className="mb-1 text-lg font-semibold">日報・工数管理システム</h1>
        <p className="mb-6 text-[13px] text-text-dim">
          Google アカウントでログインしてください。
        </p>

        {error && (
          <div
            role="alert"
            data-testid="login-error"
            className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-700"
          >
            {errorMessage(error)}
          </div>
        )}

        <button
          type="button"
          data-testid="login-google"
          onClick={handleGoogleSignIn}
          disabled={submitting}
          className="w-full cursor-pointer rounded-md border border-border bg-white px-4 py-2.5 text-[13px] font-medium transition-colors duration-150 hover:bg-surface-hover disabled:opacity-60"
        >
          {submitting ? 'ログインしています…' : 'Google でログイン'}
        </button>
      </div>
    </div>
  )
}
