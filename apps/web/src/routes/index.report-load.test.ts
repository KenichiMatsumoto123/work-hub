/**
 * 日報入力画面のソース断言（AC-L60 / AC-L62）
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
})

const source = readFileSync(
  fileURLToPath(new URL('./index.tsx', import.meta.url)),
  'utf-8',
)

describe('AC-L60 オートセーブ・テンプレの廃止', () => {
  const forbidden = [
    'sessionStorage',
    'localStorage',
    'session.get',
    'session.set',
    'storage.get',
    'storage.set',
    'daily-report-autosave',
    'daily-report-latest',
    'saveTemplate',
  ] as const

  it.each(forbidden)('%s が index.tsx に無い', (token) => {
    expect(source.includes(token)).toBe(false)
  })
})

describe('AC-L62 テンプレイベントの非送信', () => {
  it('templateSaveSucceeded が index.tsx に無い', () => {
    expect(source.includes('templateSaveSucceeded')).toBe(false)
  })

  it('templateSaveFailed が index.tsx に無い', () => {
    expect(source.includes('templateSaveFailed')).toBe(false)
  })
})
