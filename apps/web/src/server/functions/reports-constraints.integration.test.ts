/**
 * 工数実績の正規化保存：DB込み結合テスト（テスト観点表 1.2 DB 制約依存）
 *
 * 対象観点：2-1・2-2・2-3・2-5・2-6・2-7・2-8（2-4・2-9 は対象外）
 *
 * 2-1〜2-3 はユニーク制約（S-1〜S-3）そのものの検証であり、
 * SQLSTATE は `(e.cause?.code ?? e.code)` で取得する（1.0 節 規定 9）。
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { clients, projects, tasks } from '../schema'
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
  clientsByPrefix,
  dailyReportOfDate,
  entriesWithTaskOfDate,
  entrySummaryOfDate,
  errorMessageOf,
  projectsByPrefix,
  saveReport,
  sqlStateOf,
  taskTitlesByPrefix,
  testDb,
} from '../../test/report-db-helpers'

const DATES = [
  '2000-01-25',
  '2000-01-26',
  '2000-01-27',
  '2000-01-28',
  '2000-02-01',
  '2000-02-02',
  '2000-02-03',
  '2000-02-04',
  '2000-02-05',
  '2000-02-06',
  '2000-02-07',
]

beforeAll(async () => {
  await assertDatesAreReal(DATES)
})

beforeEach(() => {
  vi.clearAllMocks()
})

/** 直接 INSERT の結果を「throw したか」と SQLSTATE で観測する */
async function insertResult(run: () => Promise<unknown>) {
  try {
    await run()
    return { threw: false, sqlState: undefined as string | undefined }
  } catch (error) {
    return { threw: true, sqlState: sqlStateOf(error) }
  }
}

describe('2-1 ユニーク制約違反（clients・AC-42）', () => {
  const PREFIX = 'IT0201-'

  afterEach(() => cleanup(PREFIX, []))

  it('同名の取引先を直接 INSERT すると重複と判定される', async () => {
    await testDb.insert(clients).values({ name: `${PREFIX}A社` })

    const result = await insertResult(() =>
      testDb.insert(clients).values({ name: `${PREFIX}A社` }),
    )

    expect({ ...result, rows: (await clientsByPrefix(PREFIX)).length }).toEqual({
      threw: true,
      sqlState: '23505',
      rows: 1,
    })
  })
})

describe('2-2 ユニーク制約違反（projects・AC-43・AC-19）', () => {
  const PREFIX = 'IT0202-'

  afterEach(() => cleanup(PREFIX, []))

  it('① 同一取引先の下で同名のプロジェクトは重複と判定される', async () => {
    const [client] = await testDb
      .insert(clients)
      .values({ name: `${PREFIX}A社` })
      .returning({ id: clients.id })
    await testDb.insert(projects).values({ clientId: client.id, name: `${PREFIX}基幹刷新` })

    const result = await insertResult(() =>
      testDb.insert(projects).values({ clientId: client.id, name: `${PREFIX}基幹刷新` }),
    )

    expect({ ...result, rows: (await projectsByPrefix(PREFIX)).length }).toEqual({
      threw: true,
      sqlState: '23505',
      rows: 1,
    })
  })

  it('② 取引先が異なれば同名のプロジェクトを作れる', async () => {
    const inserted = await testDb
      .insert(clients)
      .values([{ name: `${PREFIX}A社` }, { name: `${PREFIX}B社` }])
      .returning({ id: clients.id })
    await testDb.insert(projects).values({ clientId: inserted[0].id, name: `${PREFIX}基幹刷新` })

    const result = await insertResult(() =>
      testDb.insert(projects).values({ clientId: inserted[1].id, name: `${PREFIX}基幹刷新` }),
    )

    expect({ ...result, rows: (await projectsByPrefix(PREFIX)).length }).toEqual({
      threw: false,
      sqlState: undefined,
      rows: 2,
    })
  })
})

describe('2-3 ユニーク制約違反（tasks・NULL を含むキー・AC-44）', () => {
  const PREFIX = 'IT0203-'

  afterEach(() => cleanup(PREFIX, []))

  it('project_id / client_id がともに NULL でも同じ title は重複と判定される', async () => {
    await testDb.insert(tasks).values({ type: 'adhoc', title: `${PREFIX}調査` })

    const result = await insertResult(() =>
      testDb.insert(tasks).values({ type: 'adhoc', title: `${PREFIX}調査` }),
    )

    expect({ ...result, rows: (await taskTitlesByPrefix(PREFIX)).length }).toEqual({
      threw: true,
      sqlState: '23505',
      rows: 1,
    })
  })
})

describe('2-5 varchar(255) 超過の事前検証（AC-38）', () => {
  const OVER_DATE = '2000-01-25'
  const EXACT_DATE = '2000-01-26'
  const PREFIX = 'IT0205-'

  afterEach(() => cleanup(PREFIX, [OVER_DATE, EXACT_DATE]))

  it('① 256 文字のタスク名は DB に触れる前に止まる', async () => {
    const message = await errorMessageOf(() =>
      saveReport(
        makeSingleBlockReport(OVER_DATE, `${PREFIX}A社`, [
          {
            label: `${PREFIX}PJ`,
            name: prefixedNameOfLength(PREFIX, 256),
            actualHours: '1.5',
          },
        ]),
      ),
    )

    expect({
      threw: message !== '（throw しなかった）',
      reportExists: (await dailyReportOfDate(OVER_DATE)) !== null,
      entries: await entrySummaryOfDate(OVER_DATE),
    }).toEqual({ threw: true, reportExists: false, entries: { count: 0, total: 0 } })
  })

  it('② 255 文字ちょうどのタスク名は保存できる', async () => {
    const title = prefixedNameOfLength(PREFIX, 255)

    const message = await errorMessageOf(() =>
      saveReport(
        makeSingleBlockReport(EXACT_DATE, `${PREFIX}A社`, [
          { label: `${PREFIX}PJ`, name: title, actualHours: '1.5' },
        ]),
      ),
    )

    expect({
      message,
      titles: (await entriesWithTaskOfDate(EXACT_DATE)).map((row) => row.title),
    }).toEqual({ message: '（throw しなかった）', titles: [title] })
  })
})

describe('2-6 numeric(4,2) の丸め（AC-31・AC-70・AC-71）', () => {
  const DATE = '2000-01-27'
  const PREFIX = 'IT0206-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('PostgreSQL の 10 進 half-up で丸められる', async () => {
    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}行1`, actualHours: '1.005' },
        { label: `${PREFIX}PJ`, name: `${PREFIX}行2`, actualHours: '2.675' },
        { label: `${PREFIX}PJ`, name: `${PREFIX}行3`, actualHours: '8.575' },
      ]),
    )

    const rows = await entriesWithTaskOfDate(DATE)

    expect(Object.fromEntries(rows.map((row) => [row.title, row.hours]))).toEqual({
      [`${PREFIX}行1`]: '1.01',
      [`${PREFIX}行2`]: '2.68',
      [`${PREFIX}行3`]: '8.58',
    })
  })
})

describe('2-7 上限・下限の境界（AC-30・AC-32〜AC-34・AC-46・AC-47・AC-68）', () => {
  const PREFIX = 'IT0207-'
  const CASES: [string, string, { threw: boolean; hours: string[] }][] = [
    ['24', '2000-02-01', { threw: false, hours: ['24.00'] }],
    ['24.004', '2000-02-02', { threw: false, hours: ['24.00'] }],
    ['24.005', '2000-02-03', { threw: true, hours: [] }],
    ['0.005', '2000-02-04', { threw: false, hours: ['0.01'] }],
    ['0.004', '2000-02-05', { threw: false, hours: ['0.00'] }],
    ['0.0000001', '2000-02-06', { threw: false, hours: ['0.00'] }],
    ['12345678901234567890', '2000-02-07', { threw: true, hours: [] }],
  ]

  afterEach(() => cleanup(PREFIX, CASES.map(([, date]) => date)))

  it.each(CASES)('実績h "%s" の保存結果', async (value, date, expected) => {
    const message = await errorMessageOf(() =>
      saveReport(
        makeSingleBlockReport(date, `${PREFIX}A社`, [
          { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: value },
        ]),
      ),
    )

    expect({
      threw: message !== '（throw しなかった）',
      hours: (await entriesWithTaskOfDate(date)).map((row) => row.hours),
    }).toEqual(expected)
  })
})

describe('2-8 time_entries.task_id の参照整合性', () => {
  const DATE = '2000-01-28'
  const PREFIX = 'IT0208-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('各実績が入力行から解決されるべきタスクを指す', async () => {
    await saveReport(
      makeReport({
        date: DATE,
        projects: [
          makeProject({
            name: `${PREFIX}A社`,
            tasks: [makeTask({ label: `${PREFIX}PJ`, name: `${PREFIX}実装`, actualHours: '1' })],
          }),
          makeProject({
            name: `${PREFIX}B社`,
            tasks: [makeTask({ label: '', name: `${PREFIX}会議`, actualHours: '2' })],
          }),
          makeProject({
            name: '',
            tasks: [makeTask({ label: '', name: `${PREFIX}雑務`, actualHours: '3' })],
          }),
        ],
      }),
    )

    const entries = await entriesWithTaskOfDate(DATE)
    const clientNameById = new Map((await clientsByPrefix(PREFIX)).map((row) => [row.id, row.name]))
    const projectNameById = new Map(
      (await projectsByPrefix(PREFIX)).map((row) => [row.id, row.name]),
    )

    expect(
      Object.fromEntries(
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
    ).toEqual({
      '1.00': {
        title: `${PREFIX}実装`,
        type: 'project',
        client: `${PREFIX}A社`,
        project: `${PREFIX}PJ`,
      },
      '2.00': { title: `${PREFIX}会議`, type: 'adhoc', client: `${PREFIX}B社`, project: null },
      '3.00': { title: `${PREFIX}雑務`, type: 'adhoc', client: null, project: null },
    })
  })
})
