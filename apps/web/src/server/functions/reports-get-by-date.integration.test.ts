/**
 * getReportByDateFn の結合（DB込み）テスト（観点表 1.1 AC-L10 / AC-L11）
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertDatesAreReal,
  cleanup,
  saveReport,
} from '../../test/report-db-helpers'
import { makeReport } from '../../test/report-builders'

const DATES = ['2000-04-21', '2000-04-22']
const PREFIX = 'ITL-'
const ACL10_DATE = '2000-04-21'
const ACL11_DATE = '2000-04-22'

beforeAll(async () => {
  await assertDatesAreReal(DATES)
})

beforeEach(() => {
  vi.clearAllMocks()
})

const { getReportByDateFn } = await import('./reports')

function acl10Report() {
  return makeReport({
    date: ACL10_DATE,
    startTime: '8:30',
    endTime: '18:00',
    breakTime: '1:00',
    note: 'ITL-ACL10-所感',
    goodPoints: 'ITL-ACL10-良かった点',
    badPoints: 'ITL-ACL10-課題点',
    nextPlan: 'ITL-ACL10-次回',
    projects: [
      {
        id: 'p1',
        name: 'ITL-ACL10-取引先',
        plannedHours: '',
        tasks: [
          {
            id: 't1',
            label: 'ITL-ACL10-PJ',
            name: 'ITL-ACL10-タスク',
            plannedHours: '',
            actualHours: '2.5',
            progressBefore: '',
            progressExpected: '',
            progressActual: '',
          },
        ],
      },
    ],
  })
}

describe('AC-L10 保存済み 1 件を日付で読む', () => {
  afterEach(() => cleanup(PREFIX, [ACL10_DATE]))

  it('raw_data のフィールドが rowToReport と同型で復元される', async () => {
    const saved = acl10Report()
    await saveReport(saved)

    const result = await getReportByDateFn({ data: { date: ACL10_DATE } })

    expect(result).toEqual({
      date: ACL10_DATE,
      startTime: '8:30',
      endTime: '18:00',
      breakTime: '1:00',
      note: 'ITL-ACL10-所感',
      goodPoints: 'ITL-ACL10-良かった点',
      badPoints: 'ITL-ACL10-課題点',
      nextPlan: 'ITL-ACL10-次回',
      projects: [
        expect.objectContaining({
          name: 'ITL-ACL10-取引先',
          tasks: [
            expect.objectContaining({
              label: 'ITL-ACL10-PJ',
              name: 'ITL-ACL10-タスク',
              actualHours: '2.5',
            }),
          ],
        }),
      ],
    })
  })
})

describe('AC-L11 該当なし日付は null', () => {
  afterEach(() => cleanup(PREFIX, [ACL11_DATE]))

  it('行が無い日付では null を返し例外を投げない', async () => {
    await expect(
      getReportByDateFn({ data: { date: ACL11_DATE } }),
    ).resolves.toBeNull()
  })
})
