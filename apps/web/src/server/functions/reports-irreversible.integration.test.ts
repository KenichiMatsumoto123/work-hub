/**
 * 工数実績の正規化保存：DB込み結合テスト（テスト観点表 1.1 不可逆操作）
 *
 * 対象観点：1-1・1-2・1-3・1-4・1-5・1-6・1-7・1-8・1-10・1-11・1-12
 * （1-9 は対象外）
 *
 * 実行：DATABASE_URL=... npm run test:integration
 * 後始末は 1.0 節 規定 3 に従い、成否によらず afterEach で行う。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeProject, makeReport, makeSingleBlockReport, makeTask } from '../../test/report-builders'
import {
  assertDatesAreReal,
  cleanup,
  clientNamesByPrefix,
  dailyReportOfDate,
  deleteReport,
  entryCountForTasksByPrefix,
  entrySummaryOfDate,
  entriesWithTaskOfDate,
  errorMessageOf,
  projectNamesByPrefix,
  saveReport,
  sql,
  taskTitlesByPrefix,
  testDb,
} from '../../test/report-db-helpers'

const DATES = [
  '2000-01-10',
  '2000-01-11',
  '2000-01-12',
  '2000-01-13',
  '2000-01-14',
  '2000-01-15',
  '2000-01-16',
  '2000-01-17',
  '2000-01-18',
  '2000-01-19',
  '2000-01-20',
  '2000-01-21',
  '2000-01-22',
  '2000-01-23',
  '2000-01-24',
]

beforeAll(async () => {
  await assertDatesAreReal(DATES)
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('1-1 二重実行（冪等性・AC-07）', () => {
  const DATE = '2000-01-10'
  const PREFIX = 'IT0101-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('同じ内容を2回保存しても件数と合計が1回目と変わらない', async () => {
    const report = makeReport({
      date: DATE,
      projects: [
        makeProject({
          name: `${PREFIX}A社`,
          tasks: [makeTask({ label: `${PREFIX}PJ`, name: `${PREFIX}実装`, actualHours: '1.5' })],
        }),
        // 取引先が空の adhoc 行
        makeProject({
          name: '',
          tasks: [makeTask({ label: `${PREFIX}PJ2`, name: `${PREFIX}調査`, actualHours: '2' })],
        }),
        // プロジェクトが空の adhoc 行
        makeProject({
          name: `${PREFIX}B社`,
          tasks: [makeTask({ label: '', name: `${PREFIX}会議`, actualHours: '0.5' })],
        }),
      ],
    })

    await saveReport(report)
    const first = await entrySummaryOfDate(DATE)
    await saveReport(report)
    const second = await entrySummaryOfDate(DATE)

    expect({ first, second }).toEqual({
      first: { count: 3, total: 4 },
      second: { count: 3, total: 4 },
    })
  })
})

describe('1-2 二重実行（マスタ側・AC-13・AC-14・AC-15）', () => {
  const DATES_1_2 = ['2000-01-11', '2000-01-12']
  const PREFIX = 'IT0102-'

  afterEach(() => cleanup(PREFIX, DATES_1_2))

  it('2日分保存してもマスタは1件ずつのままで実績だけ2件になる', async () => {
    for (const date of DATES_1_2) {
      await saveReport(
        makeSingleBlockReport(date, `${PREFIX}A社`, [
          { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '1' },
        ]),
      )
    }

    expect({
      clients: await clientNamesByPrefix(PREFIX),
      projects: await projectNamesByPrefix(PREFIX),
      tasks: await taskTitlesByPrefix(PREFIX),
      entries: await entryCountForTasksByPrefix(PREFIX),
    }).toEqual({
      clients: [`${PREFIX}A社`],
      projects: [`${PREFIX}PJ`],
      tasks: [`${PREFIX}タスク`],
      entries: 2,
    })
  })
})

describe('1-3 削除範囲の限定（保存時・AC-11）', () => {
  const TARGET = '2000-01-13'
  const OTHER = '2000-01-14'
  const PREFIX = 'IT0103-'

  afterEach(() => cleanup(PREFIX, [TARGET, OTHER]))

  it('対象日を保存しても別日付の実績は変化しない', async () => {
    await saveReport(
      makeSingleBlockReport(OTHER, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}別日1`, actualHours: '1' },
        { label: `${PREFIX}PJ`, name: `${PREFIX}別日2`, actualHours: '2' },
      ]),
    )
    await saveReport(
      makeSingleBlockReport(TARGET, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}対象日`, actualHours: '3' },
      ]),
    )

    await saveReport(
      makeSingleBlockReport(TARGET, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}対象日`, actualHours: '4' },
      ]),
    )

    expect(await entrySummaryOfDate(OTHER)).toEqual({ count: 2, total: 3 })
  })
})

describe('1-4 削除範囲の限定（削除時・AC-12）', () => {
  const TARGET = '2000-01-15'
  const OTHER = '2000-01-16'
  const PREFIX = 'IT0104-'

  afterEach(() => cleanup(PREFIX, [TARGET, OTHER]))

  it('対象日を削除しても別日付の日報と実績は残る', async () => {
    for (const [date, hours] of [
      [TARGET, '1'],
      [OTHER, '2'],
    ]) {
      await saveReport(
        makeSingleBlockReport(date, `${PREFIX}A社`, [
          { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: hours },
        ]),
      )
    }

    await deleteReport(TARGET)

    expect({
      otherEntries: await entrySummaryOfDate(OTHER),
      otherReportExists: (await dailyReportOfDate(OTHER)) !== null,
    }).toEqual({ otherEntries: { count: 1, total: 2 }, otherReportExists: true })
  })
})

describe('1-5 日報削除に伴う連鎖削除（AC-10）', () => {
  const DATE = '2000-01-17'
  const PREFIX = 'IT0105-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('日報を削除すると当該日付の実績も消える', async () => {
    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '1.5' },
      ]),
    )
    // Given（実績のある日報）が成立していることも同時に判定する
    const beforeDelete = await entrySummaryOfDate(DATE)

    await deleteReport(DATE)

    expect({
      beforeDelete,
      afterDelete: await entrySummaryOfDate(DATE),
      reportExists: (await dailyReportOfDate(DATE)) !== null,
    }).toEqual({
      beforeDelete: { count: 1, total: 1.5 },
      afterDelete: { count: 0, total: 0 },
      reportExists: false,
    })
  })
})

describe('1-6 削除済みデータへの再操作／存在確認の判定対象（AC-10・AC-89）', () => {
  const DATE = '2000-01-18'
  const EMPTY_DATE = '2000-01-19'
  const PREFIX = 'IT0106-'

  afterEach(() => cleanup(PREFIX, [DATE, EMPTY_DATE]))

  it('① 削除済みの日付をもう一度削除すると存在しない旨のエラーになる', async () => {
    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '1.5' },
      ]),
    )
    await deleteReport(DATE)

    const message = await errorMessageOf(() => deleteReport(DATE))

    expect({
      message,
      entries: await entrySummaryOfDate(DATE),
      reportExists: (await dailyReportOfDate(DATE)) !== null,
    }).toEqual({
      message: '指定された日付の日報が存在しません。',
      entries: { count: 0, total: 0 },
      reportExists: false,
    })
  })

  it('② 削除済みの日付へ再保存すると実績が作り直される', async () => {
    const report = makeSingleBlockReport(DATE, `${PREFIX}A社`, [
      { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '1.5' },
    ])
    await saveReport(report)
    await deleteReport(DATE)

    await saveReport(report)

    expect(await entrySummaryOfDate(DATE)).toEqual({ count: 1, total: 1.5 })
  })

  it('③ 実績が1件も無い日報でも削除は成功する（存在判定は daily_reports で行う）', async () => {
    await saveReport(
      makeSingleBlockReport(EMPTY_DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}予定のみ`, actualHours: '' },
      ]),
    )

    const message = await errorMessageOf(() => deleteReport(EMPTY_DATE))

    expect({
      message,
      reportExists: (await dailyReportOfDate(EMPTY_DATE)) !== null,
    }).toEqual({ message: '（throw しなかった）', reportExists: false })
  })
})

describe('1-7 部分失敗時のロールバック（原子性・AC-39）', () => {
  const DATE = '2000-01-20'
  const PREFIX = 'IT0107-'

  beforeAll(async () => {
    // 強制終了で残留した場合に 42710 で起動不能にならないよう、冪等に張り直す（規定 8）
    await testDb.execute(
      sql`ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS tmp_fail_injection`,
    )
    await testDb.execute(
      sql`ALTER TABLE time_entries ADD CONSTRAINT tmp_fail_injection CHECK (hours <> 13.13)`,
    )
  })

  afterAll(async () => {
    await testDb.execute(
      sql`ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS tmp_fail_injection`,
    )
  })

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('書き込みが失敗すると既存の実績も日報もそのまま残る', async () => {
    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}既存1`, actualHours: '1.5' },
        { label: `${PREFIX}PJ`, name: `${PREFIX}既存2`, actualHours: '2.5' },
      ]),
    )
    const before = await entrySummaryOfDate(DATE)
    const rawBefore = (await dailyReportOfDate(DATE))?.rawData

    const message = await errorMessageOf(() =>
      saveReport(
        makeSingleBlockReport(DATE, `${PREFIX}A社`, [
          { label: `${PREFIX}PJ`, name: `${PREFIX}障害注入`, actualHours: '13.13' },
        ]),
      ),
    )

    expect({
      before,
      threw: message !== '（throw しなかった）',
      after: await entrySummaryOfDate(DATE),
      titles: (await entriesWithTaskOfDate(DATE)).map((row) => row.title).sort(),
      rawDataUnchanged:
        JSON.stringify((await dailyReportOfDate(DATE))?.rawData) === JSON.stringify(rawBefore),
    }).toEqual({
      before: { count: 2, total: 4 },
      threw: true,
      after: { count: 2, total: 4 },
      titles: [`${PREFIX}既存1`, `${PREFIX}既存2`],
      rawDataUnchanged: true,
    })
  })
})

describe('1-8 検証エラー時に DB へ触れないこと（AC-36）', () => {
  const DATE = '2000-01-21'
  const PREFIX = 'IT0108-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('実績h が上限を超える行があると保存前の状態が保たれる', async () => {
    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}既存`, actualHours: '1.5' },
      ]),
    )
    const rawBefore = JSON.stringify((await dailyReportOfDate(DATE))?.rawData)

    const message = await errorMessageOf(() =>
      saveReport(
        makeSingleBlockReport(DATE, `${PREFIX}A社`, [
          { label: `${PREFIX}PJ`, name: `${PREFIX}上限超過`, actualHours: '25' },
        ]),
      ),
    )

    expect({
      threw: message !== '（throw しなかった）',
      entries: await entrySummaryOfDate(DATE),
      titles: (await entriesWithTaskOfDate(DATE)).map((row) => row.title),
      rawDataUnchanged: JSON.stringify((await dailyReportOfDate(DATE))?.rawData) === rawBefore,
    }).toEqual({
      threw: true,
      entries: { count: 1, total: 1.5 },
      titles: [`${PREFIX}既存`],
      rawDataUnchanged: true,
    })
  })
})

describe('1-10 マスタは削除されないこと（AC-22）', () => {
  const DATE = '2000-01-22'
  const PREFIX = 'IT0110-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('日報を削除してもマスタは残る', async () => {
    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '1.5' },
      ]),
    )

    await deleteReport(DATE)

    expect({
      clients: await clientNamesByPrefix(PREFIX),
      projects: await projectNamesByPrefix(PREFIX),
      tasks: await taskTitlesByPrefix(PREFIX),
    }).toEqual({
      clients: [`${PREFIX}A社`],
      projects: [`${PREFIX}PJ`],
      tasks: [`${PREFIX}タスク`],
    })
  })
})

describe('1-11 行を削除して再保存（AC-08）', () => {
  const DATE = '2000-01-23'
  const PREFIX = 'IT0111-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('削除した行に対応する実績が残らない', async () => {
    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}残す`, actualHours: '1' },
        { label: `${PREFIX}PJ`, name: `${PREFIX}消す`, actualHours: '2' },
      ]),
    )

    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}残す`, actualHours: '1' },
      ]),
    )

    expect(
      (await entriesWithTaskOfDate(DATE)).map((row) => ({ title: row.title, hours: row.hours })),
    ).toEqual([{ title: `${PREFIX}残す`, hours: '1.00' }])
  })
})

describe('1-12 実績h を変更して再保存（AC-09）', () => {
  const DATE = '2000-01-24'
  const PREFIX = 'IT0112-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('旧値のレコードが残らず新しい値に置き換わる', async () => {
    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '1.5' },
      ]),
    )

    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '2.5' },
      ]),
    )

    expect(
      (await entriesWithTaskOfDate(DATE)).map((row) => ({ title: row.title, hours: row.hours })),
    ).toEqual([{ title: `${PREFIX}タスク`, hours: '2.50' }])
  })
})
