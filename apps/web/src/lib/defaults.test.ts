/**
 * defaultDailyReport の単体テスト（AC-L04）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('./time-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./time-utils')>()
  return {
    ...actual,
    getToday: vi.fn(() => '2026-08-17'),
  }
})

const { defaultDailyReport } = await import('./defaults')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AC-L04 defaultDailyReport', () => {
  it('date は getToday() と同一である', () => {
    expect(defaultDailyReport().date).toBe('2026-08-17')
  })

  it('引数で日付を指定したときはその日付を使う', () => {
    expect(defaultDailyReport('2000-04-21').date).toBe('2000-04-21')
  })

  it('日付初期値に toISOString().slice(0, 10) を使わない', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./defaults.ts', import.meta.url)),
      'utf-8',
    )
    expect(source).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/)
  })
})
