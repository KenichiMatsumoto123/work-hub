import type { ReactNode } from 'react'

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] text-text-dim font-semibold tracking-wider uppercase ${className}`}>
      {children}
    </span>
  )
}
