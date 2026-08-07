import { createFileRoute, redirect } from '@tanstack/react-router'
import { signIn } from '~/lib/auth-client'

export const Route = createFileRoute('/login')({
  // 既ログインなら / へ（ログイン画面を見せない）
  beforeLoad: ({ context }) => {
    if (context.session) {
      throw redirect({ to: '/' })
    }
  },
  // ドメイン拒否などのエラーを URL クエリで受け取る
  validateSearch: (search: Record<string, unknown>): { error?: string } => {
    return { error: typeof search.error === 'string' ? search.error : undefined }
  },
  component: LoginPage,
})

function LoginPage() {
  const { error } = Route.useSearch()

  const handleGoogleLogin = () => {
    signIn.social({ provider: 'google', callbackURL: '/' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-8 flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-[40px]">📋</span>
          <h1 className="text-xl font-bold tracking-tight">日報・工数管理</h1>
          <p className="text-xs text-text-dim">
            社内アカウントでログインしてください
          </p>
        </div>

        {error && (
          <p className="w-full text-center text-[13px] text-danger bg-danger-dim rounded-md px-3 py-2">
            {error === 'access_denied' || error.includes('domain')
              ? 'このドメインのアカウントは利用できません'
              : 'ログインに失敗しました。もう一度お試しください'}
          </p>
        )}

        <button
          onClick={handleGoogleLogin}
          className="w-full bg-accent text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 hover:opacity-85 cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <span>🔑</span>
          Googleでログイン
        </button>
      </div>
    </div>
  )
}
