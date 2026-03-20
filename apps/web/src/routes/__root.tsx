/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import '~/styles/app.css'

export const Route = createRootRoute({
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

function RootComponent() {
  return (
    <RootDocument>
      {/* Global Nav */}
      <nav className="bg-surface border-b border-border px-6 py-2 flex items-center gap-1">
        <span className="text-[20px] mr-2">📋</span>
        <NavLink to="/">日報入力</NavLink>
        <NavLink to="/timesheet">工数管理</NavLink>
        <NavLink to="/attendance">勤怠管理</NavLink>
      </nav>
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
