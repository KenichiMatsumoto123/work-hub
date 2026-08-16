/**
 * reportStorage.getByDate の結合（内部）テスト（AC-L14）
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~/server/functions/reports', () => ({
  getAllReportsFn: vi.fn(),
  getReportsByMonthFn: vi.fn(),
  saveReportFn: vi.fn(),
  deleteReportFn: vi.fn(),
  getReportByDateFn: vi.fn(),
}))

const { getReportByDateFn } = await import('~/server/functions/reports')
const { reportStorage } = await import('./storage')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AC-L14 reportStorage.getByDate', () => {
  it('getReportByDateFn が失敗したとき例外を再throw する（null に吞まない）', async () => {
    const failure = new Error('network failure')
    vi.mocked(getReportByDateFn).mockRejectedValue(failure)

    await expect(reportStorage.getByDate('2000-04-21')).rejects.toBe(failure)
  })

  it('getByDate は try/catch で失敗を null に正規化しない（ソース断言）', async () => {
    const source = readFileSync(
      fileURLToPath(new URL('./storage.ts', import.meta.url)),
      'utf-8',
    )
    const slice = source.slice(source.indexOf('async getByDate'))
    expect(slice).not.toMatch(/catch\s*\{[^}]*return\s+null/)
  })
})
