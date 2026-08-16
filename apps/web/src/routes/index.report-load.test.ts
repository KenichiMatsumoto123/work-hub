/**
 * 日報入力画面のソース断言（AC-L35 / AC-L53 / AC-L60 / AC-L62）
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

describe('AC-L35 空日付保存の dateMissing 回帰', () => {
  it('dateMissing が index.tsx に残っている', () => {
    expect(source.includes('dateMissing')).toBe(true)
  })
})

describe('AC-L53 入力タブ切替では confirm を使わない', () => {
  const tabSectionStart = source.indexOf('{/* Tabs */}')
  const tabSectionEnd = source.indexOf('{/* Content */}')
  const tabSection = source.slice(tabSectionStart, tabSectionEnd)

  it('タブ切替（入力/日報/PJ稼働/勤怠）の TabButton onClick に confirm が無い', () => {
    expect(tabSection.includes('window.confirm')).toBe(false)
    expect(tabSection.includes('confirm(')).toBe(false)
  })
})
