import type { ReactNode } from 'react'
import {
  createFileRoute,
  redirect,
  Outlet,
  Link,
  useRouter,
} from '@tanstack/react-router'
import { signOut } from '~/lib/auth-client'

export const Route = createFileRoute('/_authed')({
  // サーバ側で取得済みのセッション（__root の context）を見て未認証なら /login へ。
  // 未認証時は保護ページが一切描画されない（チラ見え無し）。
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
    return { session: context.session }
  },
  component: AuthedLayout,
})

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-1.5 rounded-md text-[13px] transition-all duration-150 hover:bg-surface-hover"
      activeProps={{
        className:
          'px-3 py-1.5 rounded-md text-[13px] bg-accent text-white font-semibold',
      }}
    >
      {children}
    </Link>
  )
}

function AuthedLayout() {
  const { session } = Route.useRouteContext()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    await router.navigate({ to: '/login' })
  }

  return (
    <>
      {/* Global Nav */}
      <nav className="bg-surface border-b border-border px-6 py-2 flex items-center gap-1">
        <span className="text-[20px] mr-2">📋</span>
        <NavLink to="/">日報入力</NavLink>
        <NavLink to="/timesheet">工数管理</NavLink>
        <NavLink to="/attendance">勤怠管理</NavLink>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[13px] text-text-dim">
            {session?.user?.name ?? session?.user?.email}
          </span>
          <button
            onClick={handleSignOut}
            className="px-3 py-1.5 rounded-md text-[13px] bg-surface-hover text-text transition-all duration-150 hover:opacity-85 cursor-pointer"
          >
            ログアウト
          </button>
        </div>
      </nav>
      <Outlet />
    </>
  )
}
