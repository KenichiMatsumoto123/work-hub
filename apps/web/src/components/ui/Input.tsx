import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  sizeVariant?: 'default' | 'small'
}

export function Input({ sizeVariant = 'default', className = '', ...props }: InputProps) {
  const base =
    'bg-bg border border-border rounded-md text-text font-sans transition-[border-color] duration-150 focus:border-border-focus'
  const sizes = {
    default: 'text-[13px] px-2.5 py-[7px] w-full',
    small: 'text-xs px-1 py-[5px] w-[60px] text-center',
  }
  return <input className={`${base} ${sizes[sizeVariant]} ${className}`} {...props} />
}
