/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
  redirect,
} from '@tanstack/react-router'
import { authClient } from '~/lib/auth-client'
import { isPublicPath } from '~/lib/auth-redirect'
import { getSessionUserFn } from '~/server/functions/auth'
import '~/styles/app.css'

export const Route = createRootRoute({
  /**
   * 全ページ共通のログイン判定。
   * 未ログインで保護ページを開いた場合は、戻り先を持たせて /login へ送る。
   */
  beforeLoad: async ({ location }) => {
    const sessionUser = await getSessionUserFn()

    if (!sessionUser && !isPublicPath(location.pathname)) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }

    return { sessionUser }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: '日報・工数管理システム' },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
      },
    ],
  }),
  component: RootComponent,
})

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-1.5 rounded-md text-[13px] transition-all duration-150 hover:bg-surface-hover"
      activeProps={{ className: 'px-3 py-1.5 rounded-md text-[13px] bg-accent text-white font-semibold' }}
    >
      {children}
    </Link>
  )
}

/** ログイン中のユーザー表示とログアウト */
function SessionMenu({ email }: { email: string }) {
  const handleSignOut = async () => {
    await authClient.signOut()
    // クライアント側に残った画面の状態ごと捨てたいので、通常の遷移ではなく再読み込みする
    window.location.href = '/login'
  }

  return (
    <div className="ml-auto flex items-center gap-3">
      <span data-testid="session-email" className="text-[13px] text-text-dim">
        {email}
      </span>
      <button
        type="button"
        data-testid="logout"
        onClick={handleSignOut}
        className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-[13px] transition-colors duration-150 hover:bg-surface-hover"
      >
        ログアウト
      </button>
    </div>
  )
}

function RootComponent() {
  const { sessionUser } = Route.useRouteContext()

  return (
    <RootDocument>
      {/* Global Nav（ログイン中のみ表示する） */}
      {sessionUser && (
        <nav
          data-testid="global-nav"
          className="bg-surface border-b border-border px-6 py-2 flex items-center gap-1"
        >
          <span className="text-[20px] mr-2">📋</span>
          <NavLink to="/">日報入力</NavLink>
          <NavLink to="/timesheet">工数管理</NavLink>
          <NavLink to="/attendance">勤怠管理</NavLink>
          <SessionMenu email={sessionUser.email} />
        </nav>
      )}
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
