import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
}

const variants = {
  default: 'bg-surface-hover text-text px-3.5 py-[7px]',
  primary: 'bg-accent text-white px-4 py-2',
  danger: 'bg-danger-dim text-danger px-2.5 py-1.5 text-xs',
  ghost: 'bg-transparent text-text-dim px-2 py-1 text-xs',
}

export function Button({ variant = 'default', className = '', children, ...props }: ButtonProps) {
  const base =
    'border-none rounded-lg cursor-pointer font-sans text-[13px] font-medium transition-all duration-150 inline-flex items-center gap-1.5 hover:opacity-85'
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
