/**
 * 工数実績の正規化保存：DB込み結合テスト（テスト観点表 1.5 共通）
 *
 * 対象観点：5-1・5-2・5-4・5-5・5-6・5-7・5-8・5-9・5-10・5-11・5-12（5-3 は対象外）
 *
 * 接頭辞を付けられない固定名（`(名称未設定)` / `[object Object]` / 数値文字列）は
 * 1.0 節 規定 4 に従い「保存前に存在しなかった場合のみ削除する」。
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyReportData } from '~/lib/types'
import {
  makeProject,
  makeReport,
  makeSingleBlockReport,
  makeTask,
  prefixedNameOfLength,
} from '../../test/report-builders'
import {
  assertDatesAreReal,
  cleanup,
  cleanupFixedNames,
  clientNamesByPrefix,
  clientsByPrefix,
  dailyReportOfDate,
  deleteReport,
  entriesWithTaskOfDate,
  entrySummaryOfDate,
  errorMessageOf,
  projectsByPrefix,
  saveReport,
  snapshotFixedNames,
  taskTitlesByPrefix,
  tasksByPrefix,
  type FixedNameSnapshot,
} from '../../test/report-db-helpers'

const DATES = [
  '2000-02-24',
  '2000-02-27',
  '2000-02-28',
  '2000-03-01',
  '2000-03-02',
  '2000-03-03',
  '2000-03-04',
  '2000-03-05',
  '2000-03-06',
  '2000-03-07',
  '2000-03-08',
  '2000-03-11',
  '2000-03-12',
]

beforeAll(async () => {
  await assertDatesAreReal(DATES)
})

beforeEach(() => {
  vi.clearAllMocks()
})

/** 実績を「タスク名 → hours」で観測する */
async function entriesByTitle(date: string): Promise<Record<string, string>> {
  const rows = await entriesWithTaskOfDate(date)
  return Object.fromEntries(rows.map((row) => [row.title, row.hours]))
}

describe('5-1 境界値：対象行 0 件（AC-06）', () => {
  const EMPTY_HOURS_DATE = '2000-02-24'
  const NO_ROW_DATE = '2000-03-08'
  const PREFIX = 'IT0501-'

  afterEach(() => cleanup(PREFIX, [EMPTY_HOURS_DATE, NO_ROW_DATE]))

  it('① タスク行1件・実績h 空（初期状態）でも保存できる', async () => {
    const message = await errorMessageOf(() =>
      saveReport(
        makeReport({
          date: EMPTY_HOURS_DATE,
          projects: [makeProject({ tasks: [makeTask()] })],
        }),
      ),
    )

    expect({
      message,
      entries: await entrySummaryOfDate(EMPTY_HOURS_DATE),
      reportExists: (await dailyReportOfDate(EMPTY_HOURS_DATE)) !== null,
    }).toEqual({
      message: '（throw しなかった）',
      entries: { count: 0, total: 0 },
      reportExists: true,
    })
  })

  it('② タスク行が 0 件でも保存できる', async () => {
    const noProjects = makeReport({ date: NO_ROW_DATE, projects: [] })
    const emptyTasks = makeReport({
      date: NO_ROW_DATE,
      projects: [makeProject({ name: `${PREFIX}A社`, tasks: [] })],
    })

    const messages = [
      await errorMessageOf(() => saveReport(noProjects)),
      await errorMessageOf(() => saveReport(emptyTasks)),
    ]

    expect({
      messages,
      entries: await entrySummaryOfDate(NO_ROW_DATE),
      reportExists: (await dailyReportOfDate(NO_ROW_DATE)) !== null,
    }).toEqual({
      messages: ['（throw しなかった）', '（throw しなかった）'],
      entries: { count: 0, total: 0 },
      reportExists: true,
    })
  })
})

describe('5-2 境界値：対象行 1 件（AC-01・AC-02）', () => {
  const DATE = '2000-02-27'
  const PREFIX = 'IT0502-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('実績h 3.25 の行がそのまま 1 件記録される', async () => {
    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '3.25' },
      ]),
    )

    expect(await entriesByTitle(DATE)).toEqual({ [`${PREFIX}タスク`]: '3.25' })
  })
})

describe('5-4 null / undefined / 空文字（名前系・AC-23〜AC-26・AC-28）', () => {
  const DATE = '2000-02-28'
  const PREFIX = 'IT0504-'
  const FIXED_NAMES = ['(名称未設定)']
  let snapshot: FixedNameSnapshot

  beforeEach(async () => {
    snapshot = await snapshotFixedNames(FIXED_NAMES)
  })

  afterEach(async () => {
    await cleanup(PREFIX, [DATE])
    await cleanupFixedNames(snapshot)
  })

  it('取引先・プロジェクト・タスク名の欠損で type と識別情報が決まる', async () => {
    await saveReport(
      makeReport({
        date: DATE,
        projects: [
          makeProject({
            name: '',
            tasks: [
              makeTask({ label: '', name: `${PREFIX}両方空`, actualHours: '1' }),
              makeTask({ label: `${PREFIX}PJ`, name: `${PREFIX}PJのみ`, actualHours: '3' }),
              makeTask({ label: '', name: '', actualHours: '5' }),
              makeTask({ label: `${PREFIX}PJ3`, name: '', actualHours: '6' }),
            ],
          }),
          makeProject({
            name: `${PREFIX}A社`,
            tasks: [makeTask({ label: '', name: `${PREFIX}取引先のみ`, actualHours: '2' })],
          }),
          makeProject({
            name: `${PREFIX}B社`,
            tasks: [makeTask({ label: `${PREFIX}PJ2`, name: `${PREFIX}両方あり`, actualHours: '4' })],
          }),
        ],
      }),
    )

    const clientNameById = new Map((await clientsByPrefix(PREFIX)).map((row) => [row.id, row.name]))
    const projectNameById = new Map(
      (await projectsByPrefix(PREFIX)).map((row) => [row.id, row.name]),
    )
    const entries = await entriesWithTaskOfDate(DATE)

    expect({
      rows: Object.fromEntries(
        entries.map((row) => [
          row.hours,
          {
            title: row.title,
            type: row.type,
            client: row.clientId ? (clientNameById.get(row.clientId) ?? '（不明）') : null,
            project: row.projectId ? (projectNameById.get(row.projectId) ?? '（不明）') : null,
          },
        ]),
      ),
      projects: (await projectsByPrefix(PREFIX)).map((row) => row.name),
    }).toEqual({
      rows: {
        '1.00': { title: `${PREFIX}両方空`, type: 'adhoc', client: null, project: null },
        '2.00': {
          title: `${PREFIX}取引先のみ`,
          type: 'adhoc',
          client: `${PREFIX}A社`,
          project: null,
        },
        '3.00': {
          title: `${PREFIX}PJ / ${PREFIX}PJのみ`,
          type: 'adhoc',
          client: null,
          project: null,
        },
        '4.00': {
          title: `${PREFIX}両方あり`,
          type: 'project',
          client: `${PREFIX}B社`,
          project: `${PREFIX}PJ2`,
        },
        '5.00': { title: '(名称未設定)', type: 'adhoc', client: null, project: null },
        '6.00': {
          title: `${PREFIX}PJ3 / (名称未設定)`,
          type: 'adhoc',
          client: null,
          project: null,
        },
      },
      projects: [`${PREFIX}PJ2`],
    })
  })
})

describe('5-5 null / undefined / 空文字（実績h・AC-29・AC-30）', () => {
  const DATE = '2000-03-01'
  const PREFIX = 'IT0505-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('数値にならない実績h の行は throw せず実績も作られない', async () => {
    const values = ['', '   ', 'abc', '時間', '0', '-3']

    const message = await errorMessageOf(() =>
      saveReport(
        makeSingleBlockReport(
          DATE,
          `${PREFIX}A社`,
          values.map((actualHours, index) => ({
            label: `${PREFIX}PJ`,
            name: `${PREFIX}行${index + 1}`,
            actualHours,
          })),
        ),
      ),
    )

    expect({
      message,
      entries: await entrySummaryOfDate(DATE),
      clients: await clientNamesByPrefix(PREFIX),
      tasks: await taskTitlesByPrefix(PREFIX),
    }).toEqual({
      message: '（throw しなかった）',
      entries: { count: 0, total: 0 },
      clients: [],
      tasks: [],
    })
  })
})

describe('5-6 不正な型のフォールバック（AC-53・AC-69）', () => {
  const DATE = '2000-03-02'
  const PREFIX = 'IT0506-'
  const FIXED_NAMES = ['123', '[object Object]', '456 / IT0506-タスク']
  let snapshot: FixedNameSnapshot

  beforeEach(async () => {
    snapshot = await snapshotFixedNames(FIXED_NAMES)
  })

  afterEach(async () => {
    await cleanup(PREFIX, [DATE])
    await cleanupFixedNames(snapshot)
  })

  it('文字列でない名前・実績h も文字列化して保存される', async () => {
    await saveReport(
      makeReport({
        date: DATE,
        projects: [
          makeProject({
            name: 123 as unknown as string,
            tasks: [
              makeTask({
                label: null as unknown as string,
                name: {} as unknown as string,
                actualHours: 7.5 as unknown as string,
              }),
            ],
          }),
          makeProject({
            name: null as unknown as string,
            tasks: [
              makeTask({
                label: 456 as unknown as string,
                name: `${PREFIX}タスク`,
                actualHours: '1',
              }),
            ],
          }),
        ],
      }),
    )

    const clientNameById = new Map(
      (await clientsByPrefix('')).map((row) => [row.id, row.name]),
    )
    const entries = await entriesWithTaskOfDate(DATE)

    expect(
      Object.fromEntries(
        entries.map((row) => [
          row.hours,
          {
            title: row.title,
            type: row.type,
            client: row.clientId ? (clientNameById.get(row.clientId) ?? '（不明）') : null,
            hasProject: row.projectId !== null,
          },
        ]),
      ),
    ).toEqual({
      '7.50': { title: '[object Object]', type: 'adhoc', client: '123', hasProject: false },
      '1.00': {
        title: `456 / ${PREFIX}タスク`,
        type: 'adhoc',
        client: null,
        hasProject: false,
      },
    })
  })
})

describe('5-7 想定外の値のフォールバック（AC-35・AC-30・AC-47）', () => {
  const PREFIX = 'IT0507-'
  const HOURS_SUFFIX_DATE = '2000-03-03'
  const HEX_DATE = '2000-03-11'
  const HUGE_DATE = '2000-03-12'

  afterEach(() => cleanup(PREFIX, [HOURS_SUFFIX_DATE, HEX_DATE, HUGE_DATE]))

  it('① "7.5h" は 7.50 として記録される（AC-35）', async () => {
    const message = await errorMessageOf(() =>
      saveReport(
        makeSingleBlockReport(HOURS_SUFFIX_DATE, `${PREFIX}A社`, [
          { label: `${PREFIX}PJ`, name: `${PREFIX}単位つき`, actualHours: '7.5h' },
        ]),
      ),
    )

    expect({ message, entries: await entriesByTitle(HOURS_SUFFIX_DATE) }).toEqual({
      message: '（throw しなかった）',
      entries: { [`${PREFIX}単位つき`]: '7.50' },
    })
  })

  it('② "0x10" は実績が作られず throw もしない（AC-30）', async () => {
    const message = await errorMessageOf(() =>
      saveReport(
        makeSingleBlockReport(HEX_DATE, `${PREFIX}A社`, [
          { label: `${PREFIX}PJ`, name: `${PREFIX}16進`, actualHours: '0x10' },
        ]),
      ),
    )

    expect({ message, entries: await entrySummaryOfDate(HEX_DATE) }).toEqual({
      message: '（throw しなかった）',
      entries: { count: 0, total: 0 },
    })
  })

  it('③ 20 桁の実績h は保存全体が失敗する（AC-47）', async () => {
    const message = await errorMessageOf(() =>
      saveReport(
        makeSingleBlockReport(HUGE_DATE, `${PREFIX}A社`, [
          { label: `${PREFIX}PJ`, name: `${PREFIX}巨大`, actualHours: '12345678901234567890' },
        ]),
      ),
    )

    expect({
      threw: message !== '（throw しなかった）',
      entries: await entrySummaryOfDate(HUGE_DATE),
    }).toEqual({ threw: true, entries: { count: 0, total: 0 } })
  })
})

describe('5-8 新規作成時の既定値（AC-58）', () => {
  const DATE = '2000-03-04'
  const PREFIX = 'IT0508-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('新しいタスクの status は active・priority は medium になる', async () => {
    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}新規`, actualHours: '1' },
      ]),
    )

    expect(
      (await tasksByPrefix(PREFIX)).map((row) => ({
        title: row.title,
        status: row.status,
        priority: row.priority,
      })),
    ).toEqual([{ title: `${PREFIX}新規`, status: 'active', priority: 'medium' }])
  })
})

describe('5-9 raw_data と既存カラムの不変性（AC-04・AC-05）', () => {
  const DATE = '2000-03-05'
  const PREFIX = 'IT0509-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  function reportWith(startTime: string, endTime: string): DailyReportData {
    return makeReport({
      date: DATE,
      startTime,
      endTime,
      breakTime: '1:00',
      note: '所感メモ',
      goodPoints: 'よかった点',
      badPoints: 'わるかった点',
      nextPlan: '次の予定',
      projects: [
        makeProject({
          name: `${PREFIX}A社`,
          plannedHours: '8',
          tasks: [
            makeTask({
              label: `${PREFIX}PJ`,
              name: `${PREFIX}タスク`,
              plannedHours: '2',
              actualHours: '1.5',
              progressBefore: '10',
              progressExpected: '50',
              progressActual: '40',
            }),
          ],
        }),
      ],
    })
  }

  it('入力した日報の内容がそのまま daily_reports に格納される', async () => {
    const report = reportWith('9:00', '18:00')

    await saveReport(report)
    const row = await dailyReportOfDate(DATE)

    expect({
      rawData: row?.rawData,
      date: row?.date,
      startTime: row?.startTime,
      endTime: row?.endTime,
      breakTime: row?.breakTime,
      note: row?.note,
      goodPoints: row?.goodPoints,
      badPoints: row?.badPoints,
      nextPlan: row?.nextPlan,
      totalWorkHours: row?.totalWorkHours,
    }).toEqual({
      rawData: report,
      date: DATE,
      startTime: '9:00',
      endTime: '18:00',
      breakTime: '1:00',
      note: '所感メモ',
      goodPoints: 'よかった点',
      badPoints: 'わるかった点',
      nextPlan: '次の予定',
      totalWorkHours: '8.00',
    })
  })

  it('終業が始業より前でも total_work_hours は 0 に下限クランプされる', async () => {
    const report = reportWith('18:00', '9:00')

    await saveReport(report)
    const row = await dailyReportOfDate(DATE)

    expect({ rawData: row?.rawData, totalWorkHours: row?.totalWorkHours }).toEqual({
      rawData: report,
      totalWorkHours: '0.00',
    })
  })
})

describe('5-10 日付検証（AC-73・AC-74・AC-76〜AC-78・AC-83〜AC-85）', () => {
  const PREFIX = 'IT0510-'
  const 構造エラー = '日報のデータ形式が不正です。'
  const 不在エラー = '指定された日付の日報が存在しません。'
  const REJECTED = [
    '2000-1-1',
    '2026-02-30',
    '0000-01-01',
    '2026-13-01',
    '2026-00-10',
    '2026-01-00',
    '2026-02-29',
    '1900-02-29',
    '0050-02-29',
  ]
  const ACCEPTED = ['2028-02-29', '2000-02-29', '0004-02-29', '0050-03-01']
  /** 拒否されるはずの入力が誤って書き込まれた場合の後始末対象（'2000-1-1' は 2000-01-01 として解釈される） */
  const CLEANUP_DATES = [...ACCEPTED, '2000-01-01']

  beforeAll(async () => {
    await assertDatesAreReal(ACCEPTED)
  })

  function reportFor(date: unknown): unknown {
    return {
      ...makeSingleBlockReport('2000-01-01', `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '1' },
      ]),
      date,
    }
  }

  describe.each(['UTC', 'Asia/Tokyo', 'America/New_York'])('TZ=%s', (timezone) => {
    let originalTz: string | undefined

    beforeEach(() => {
      originalTz = process.env.TZ
      process.env.TZ = timezone
    })

    afterEach(async () => {
      process.env.TZ = originalTz
      await cleanup(PREFIX, CLEANUP_DATES)
    })

    it('拒否される日付は保存も削除も構造エラーになる', async () => {
      const observed: Record<string, { save: string; delete: string }> = {}
      for (const date of REJECTED) {
        observed[date] = {
          delete: await errorMessageOf(() => deleteReport(date)),
          save: await errorMessageOf(() => saveReport(reportFor(date))),
        }
      }

      expect(observed).toEqual(
        Object.fromEntries(
          REJECTED.map((date) => [date, { delete: 構造エラー, save: 構造エラー }]),
        ),
      )
    })

    it('data 自体が null でも構造エラーになる（AC-76）', async () => {
      expect({
        save: await errorMessageOf(() => saveReport(null)),
        delete: await errorMessageOf(() => deleteReport(undefined)),
      }).toEqual({ save: 構造エラー, delete: 構造エラー })
    })

    it('通過する日付は日付検証で止まらない', async () => {
      const observed: Record<string, { save: string; delete: string }> = {}
      for (const date of ACCEPTED) {
        // save を先に呼ぶと delete が正常終了して AC-89 の判定ができなくなる
        const deleteMessage = await errorMessageOf(() => deleteReport(date))
        const saveMessage = await errorMessageOf(() => saveReport(reportFor(date)))
        observed[date] = { delete: deleteMessage, save: saveMessage }
      }

      expect(observed).toEqual(
        Object.fromEntries(
          ACCEPTED.map((date) => [
            date,
            { delete: 不在エラー, save: '（throw しなかった）' },
          ]),
        ),
      )
    })
  })
})

describe('5-11 有効行と無効行が混在する日報（AC-03・AC-01）', () => {
  const DATE = '2000-03-06'
  const PREFIX = 'IT0511-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  async function saveRows(hours: string[]): Promise<void> {
    await saveReport(
      makeSingleBlockReport(
        DATE,
        `${PREFIX}A社`,
        hours.map((actualHours, index) => ({
          label: `${PREFIX}PJ`,
          name: `${PREFIX}R${index + 1}`,
          actualHours,
        })),
      ),
    )
  }

  it('① 有効行が先頭に並ぶ場合', async () => {
    await saveRows(['7.5', '2.675', '0.004', ''])

    expect({
      summary: await entrySummaryOfDate(DATE),
      rows: await entriesByTitle(DATE),
    }).toEqual({
      summary: { count: 2, total: 10.18 },
      rows: { [`${PREFIX}R1`]: '7.50', [`${PREFIX}R2`]: '2.68' },
    })
  })

  it('② 無効行が先頭・中間に混じる場合', async () => {
    await saveRows(['', '7.5', '0.004', '2.675'])

    expect({
      summary: await entrySummaryOfDate(DATE),
      rows: await entriesByTitle(DATE),
    }).toEqual({
      summary: { count: 2, total: 10.18 },
      rows: { [`${PREFIX}R2`]: '7.50', [`${PREFIX}R4`]: '2.68' },
    })
  })
})

describe('5-12 無効行の長い名前で保存が止まらないこと（AC-48・AC-27）', () => {
  const DATE = '2000-03-07'
  const PREFIX = 'IT0512-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('実績h が無効な行の 300 文字の名前は保存を止めない', async () => {
    const longName = prefixedNameOfLength(PREFIX, 300)

    const message = await errorMessageOf(() =>
      saveReport(
        makeReport({
          date: DATE,
          projects: [
            makeProject({
              name: `${PREFIX}A社`,
              tasks: [makeTask({ label: `${PREFIX}PJ`, name: `${PREFIX}有効`, actualHours: '1' })],
            }),
            makeProject({
              name: longName,
              tasks: [makeTask({ label: longName, name: longName, actualHours: '' })],
            }),
          ],
        }),
      ),
    )

    expect({
      message,
      entries: await entriesByTitle(DATE),
      clients: await clientNamesByPrefix(PREFIX),
      projects: (await projectsByPrefix(PREFIX)).map((row) => row.name),
      tasks: await taskTitlesByPrefix(PREFIX),
    }).toEqual({
      message: '（throw しなかった）',
      entries: { [`${PREFIX}有効`]: '1.00' },
      clients: [`${PREFIX}A社`],
      projects: [`${PREFIX}PJ`],
      tasks: [`${PREFIX}有効`],
    })
  })
})
