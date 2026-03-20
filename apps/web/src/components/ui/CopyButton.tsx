'use client'
import { useState } from 'react'
import { Button } from './Button'

export function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('copied')
    } catch {
      setStatus('error')
    }
    setTimeout(() => setStatus('idle'), 1500)
  }

  const label =
    status === 'copied' ? '✓ コピー済' : status === 'error' ? '⚠ コピー失敗' : '📋 コピー'

  return (
    <Button variant="primary" onClick={handleCopy} className="text-xs !px-3.5 !py-1.5">
      {label}
    </Button>
  )
}
