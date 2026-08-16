/**
 * getReportFn の DB込み結合テスト
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeReport } from '../../test/report-builders'
import {
  assertDatesAreReal,
  cleanup,
  saveReport,
} from '../../test/report-db-helpers'
import { getReportFn } from './reports'

const DATE = '2000-03-13'
const PREFIX = 'IT-READ-'

beforeAll(async () => {
  await assertDatesAreReal([DATE])
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => cleanup(PREFIX, [DATE]))

describe('getReportFn', () => {
  it('保存済み日報を日付で取得できる', async () => {
    const report = makeReport({
      date: DATE,
      goodPoints: `${PREFIX}良かった`,
      projects: [],
    })
    await saveReport(report)

    const loaded = await getReportFn({ data: { date: DATE } })

    expect(loaded).toMatchObject({
      date: DATE,
      goodPoints: `${PREFIX}良かった`,
    })
  })

  it('未保存の日付は null を返す', async () => {
    const loaded = await getReportFn({ data: { date: DATE } })
    expect(loaded).toBeNull()
  })

  it('不正な日付は null を返す', async () => {
    const loaded = await getReportFn({ data: { date: 'not-a-date' } })
    expect(loaded).toBeNull()
  })
})
