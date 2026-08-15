/**
 * 工数実績の正規化保存：DB込み結合テスト（テスト観点表 1.4 トランザクション）
 *
 * 対象観点：4-2・4-3・4-4・4-5・4-9（4-1 は 1-7 と同一、4-6・4-7・4-8・4-10 は対象外）
 *
 * 1.4 節「並行性テストの土台」の規定 1〜8 に従う：
 * 1. 専用クライアント（`{ max: 1 }`）を立てる（`testDb` は本体とプールを共有するため使えない）
 * 2. ロック保持用と観測用のクライアントを分ける
 * 3. サーバー関数は起動直後に `.catch()` を装着する（`track`）
 * 4. 待ち時間 X は `max(10T, 300ms)`。T は捨て日付で 1 回だけ測る（規定 7）
 * 5. 解放後の待ちに固定 sleep を使わない
 * 6. 解放は成否によらず `finally` で行う
 * 7. 専用クライアントは `end()` で閉じる
 * 8. 観測クライアントの未コミットトランザクションは必ず COMMIT / ROLLBACK する
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeProject, makeReport, makeSingleBlockReport, makeTask } from '../../test/report-builders'
import {
  advisoryKeyOf,
  advisoryLockCount,
  assertDatesAreReal,
  cleanup,
  clientsByPrefix,
  dailyReportOfDate,
  entriesWithTaskOfDate,
  entrySummaryOfDate,
  errorMessageOf,
  makeDedicatedClient,
  projectsByPrefix,
  saveReport,
  deleteReport,
  track,
  wait,
  type DedicatedClient,
} from '../../test/report-db-helpers'

const T_MEASURE_DATE = '2000-03-10'
const T_MEASURE_PREFIX = 'IT0000-'
const DATES = [
  '2000-02-19',
  '2000-02-20',
  '2000-02-21',
  '2000-02-22',
  '2000-02-23',
  '2000-02-25',
  '2000-02-26',
  T_MEASURE_DATE,
]

/** ロック保持用クライアント */
let lockClient: DedicatedClient
/** 観測用クライアント（未コミットトランザクションを開く側） */
let observerClient: DedicatedClient
/** 第 3 のクライアント（pg_locks の照会用） */
let queryClient: DedicatedClient
/** 「待たされていること」の判定待ち時間 */
let waitMs = 300

beforeAll(async () => {
  await assertDatesAreReal(DATES)
  lockClient = makeDedicatedClient()
  observerClient = makeDedicatedClient()
  queryClient = makeDedicatedClient()

  // 規定 7：捨て日付で 1 回だけ T を測り、全観点で共有する。
  // マスタを 1 組新規作成する対象行を 1 件含める（空の日報では代表値にならない）。
  const startedAt = Date.now()
  await saveReport(
    makeSingleBlockReport(T_MEASURE_DATE, `${T_MEASURE_PREFIX}A社`, [
      {
        label: `${T_MEASURE_PREFIX}PJ`,
        name: `${T_MEASURE_PREFIX}タスク`,
        actualHours: '1',
      },
    ]),
  )
  const elapsed = Date.now() - startedAt
  waitMs = Math.max(elapsed * 10, 300)

  await cleanup(T_MEASURE_PREFIX, [T_MEASURE_DATE])
}, 60_000)

afterAll(async () => {
  await Promise.all([lockClient?.end(), observerClient?.end(), queryClient?.end()])
})

beforeEach(() => {
  vi.clearAllMocks()
})

/** 対象日のアドバイザリロックをロック保持クライアントで保持し、確実に解放する */
async function withHeldLock<T>(
  date: string,
  body: (release: () => Promise<void>) => Promise<T>,
): Promise<T> {
  const key = await advisoryKeyOf(queryClient, date)
  let released = false
  const release = async () => {
    if (released) return
    released = true
    await lockClient`SELECT pg_advisory_unlock(${key}::bigint)`
  }

  await lockClient`SELECT pg_advisory_lock(${key}::bigint)`
  try {
    return await body(release)
  } finally {
    await release()
    await lockClient`SELECT pg_advisory_unlock_all()`
  }
}

async function entriesByTitle(date: string): Promise<Record<string, string>> {
  const rows = await entriesWithTaskOfDate(date)
  return Object.fromEntries(rows.map((row) => [row.title, row.hours]))
}

function stable(record: Record<string, string>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(record).sort()))
}

describe('4-2 同一日付の並行保存の直列化（AC-45）', () => {
  const DATE = '2000-02-19'
  const PREFIX = 'IT0402-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('先発のコミットまで後発は進行せず、最終状態は一方の内容と一致する', async () => {
    const reportA = makeSingleBlockReport(DATE, `${PREFIX}社`, [
      { label: `${PREFIX}PJ`, name: `${PREFIX}A`, actualHours: '1.0' },
    ])
    const reportB = makeSingleBlockReport(DATE, `${PREFIX}社`, [
      { label: `${PREFIX}PJ`, name: `${PREFIX}B`, actualHours: '2.0' },
      { label: `${PREFIX}PJ`, name: `${PREFIX}C`, actualHours: '3.0' },
    ])

    const observed = await withHeldLock(DATE, async (release) => {
      const a = track(saveReport(reportA))
      const b = track(saveReport(reportB))

      await wait(waitMs)
      const pending = { a: !a.isSettled(), b: !b.isSettled() }

      await release()
      await Promise.all([a.done, b.done])

      return { pending, entries: await entriesByTitle(DATE) }
    })

    const acceptable: Record<string, string>[] = [
      { [`${PREFIX}A`]: '1.00' },
      { [`${PREFIX}B`]: '2.00', [`${PREFIX}C`]: '3.00' },
    ]
    const acceptableJson = acceptable.map(stable)

    expect({
      pending: observed.pending,
      outcome: acceptableJson.includes(stable(observed.entries))
        ? 'どちらか一方の内容と完全一致'
        : stable(observed.entries),
    }).toEqual({
      pending: { a: true, b: true },
      outcome: 'どちらか一方の内容と完全一致',
    })
  })
})

describe('4-3 保存と削除の直列化（AC-54）', () => {
  const DATE = '2000-02-20'
  const PREFIX = 'IT0403-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('削除もロックの解放まで進行しない', async () => {
    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '1' },
      ]),
    )

    const observed = await withHeldLock(DATE, async (release) => {
      const removal = track(deleteReport(DATE))

      await wait(waitMs)
      const pending = !removal.isSettled()

      await release()
      const settled = await removal.done

      return { pending, threw: settled.err !== undefined }
    })

    expect({
      ...observed,
      reportExists: (await dailyReportOfDate(DATE)) !== null,
    }).toEqual({ pending: true, threw: false, reportExists: false })
  })
})

describe('4-4 日報行が無い状態での保存↔削除の直列化（AC-55・AC-89）', () => {
  const DATE = '2000-02-21'
  const PREFIX = 'IT0404-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('対象日に日報行が無くても両者はロックの解放まで進行しない', async () => {
    const report = makeSingleBlockReport(DATE, `${PREFIX}A社`, [
      { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '1' },
    ])

    const observed = await withHeldLock(DATE, async (release) => {
      const saving = track(saveReport(report))
      const removal = track(deleteReport(DATE))

      await wait(waitMs)
      const pending = { save: !saving.isSettled(), delete: !removal.isSettled() }

      await release()
      await Promise.all([saving.done, removal.done])

      return pending
    })

    const reportExists = (await dailyReportOfDate(DATE)) !== null
    const entries = await entrySummaryOfDate(DATE)

    expect({
      pending: observed,
      orphanTimeEntries: !reportExists && entries.count > 0,
    }).toEqual({ pending: { save: true, delete: true }, orphanTimeEntries: false })
  })
})

describe('4-5 アドバイザリロックの保持範囲（AC-72）', () => {
  const SAVE_DATE = '2000-02-22'
  const DELETE_DATE = '2000-02-25'
  const DELETE_BLOCK_DATE = '2000-02-26'
  const PREFIX = 'IT0405-'

  afterEach(() => cleanup(PREFIX, [SAVE_DATE, DELETE_DATE, DELETE_BLOCK_DATE]))

  it('① 陽性対照：advisory ロックの照会が機能する', async () => {
    const key = await advisoryKeyOf(queryClient, SAVE_DATE)

    let held = -1
    try {
      await observerClient`SELECT pg_advisory_lock(${key}::bigint)`
      held = await advisoryLockCount(queryClient, key)
    } finally {
      await observerClient`SELECT pg_advisory_unlock_all()`
    }
    const afterRelease = await advisoryLockCount(queryClient, key)

    expect({ held, afterRelease }).toEqual({ held: 1, afterRelease: 0 })
  })

  it('② saveReportFn の完了後に advisory ロックが残らない', async () => {
    const key = await advisoryKeyOf(queryClient, SAVE_DATE)

    await saveReport(
      makeSingleBlockReport(SAVE_DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '1' },
      ]),
    )

    expect(await advisoryLockCount(queryClient, key)).toBe(0)
  })

  it('③ 保存の実行中は advisory ロックが保持されている', async () => {
    const key = await advisoryKeyOf(queryClient, SAVE_DATE)
    const report = makeSingleBlockReport(SAVE_DATE, `${PREFIX}停止`, [
      { label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '1' },
    ])

    let granted = -1
    const saving = { done: Promise.resolve({} as { ok?: unknown; err?: unknown }) }
    try {
      await observerClient`BEGIN`
      await observerClient`INSERT INTO clients(name) VALUES (${`${PREFIX}停止`})`

      const tracked = track(saveReport(report))
      saving.done = tracked.done

      await wait(waitMs)
      granted = await advisoryLockCount(queryClient, key, true)
    } finally {
      await observerClient`ROLLBACK`
      await saving.done
    }

    expect(granted).toBe(1)
  })

  it('④ deleteReportFn の完了後に advisory ロックが残らない', async () => {
    const key = await advisoryKeyOf(queryClient, DELETE_DATE)

    // ④ 用の陽性対照（①のキーは別日付のため④を守らない）
    let controlHeld = -1
    try {
      await observerClient`SELECT pg_advisory_lock(${key}::bigint)`
      controlHeld = await advisoryLockCount(queryClient, key)
    } finally {
      await observerClient`SELECT pg_advisory_unlock_all()`
    }

    await saveReport(
      makeSingleBlockReport(DELETE_DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}削除対象`, actualHours: '1' },
      ]),
    )
    await deleteReport(DELETE_DATE)

    expect({ controlHeld, afterDelete: await advisoryLockCount(queryClient, key) }).toEqual({
      controlHeld: 1,
      afterDelete: 0,
    })
  })

  it('⑤ 削除の実行中は advisory ロックが保持されている', async () => {
    const key = await advisoryKeyOf(queryClient, DELETE_BLOCK_DATE)

    await saveReport(
      makeSingleBlockReport(DELETE_BLOCK_DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}PJ`, name: `${PREFIX}削除中`, actualHours: '1' },
      ]),
    )

    let granted = -1
    const removal = { done: Promise.resolve({} as { ok?: unknown; err?: unknown }) }
    try {
      await observerClient`BEGIN`
      await observerClient`SELECT id FROM daily_reports WHERE date = ${DELETE_BLOCK_DATE}::date FOR UPDATE`

      const tracked = track(deleteReport(DELETE_BLOCK_DATE))
      removal.done = tracked.done

      await wait(waitMs)
      granted = await advisoryLockCount(queryClient, key, true)
    } finally {
      await observerClient`ROLLBACK`
      await removal.done
    }

    expect(granted).toBe(1)
  })
})

describe('4-9 異なる日付の同時保存におけるマスタ作成競合（AC-63・M-1）', () => {
  const DATE = '2000-02-23'
  const PREFIX = 'IT0409-'
  const CLIENT_NAME = `${PREFIX}競合A`

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('未コミットの同名取引先があっても保存が完走し取引先は1件になる', async () => {
    const report = makeReport({
      date: DATE,
      projects: [
        makeProject({
          name: CLIENT_NAME,
          tasks: [makeTask({ label: `${PREFIX}PJ`, name: `${PREFIX}タスク`, actualHours: '1.5' })],
        }),
      ],
    })

    let pending = false
    let message = ''
    let committedClientId = ''
    const saving = { done: Promise.resolve({} as { ok?: unknown; err?: unknown }) }
    try {
      await observerClient`BEGIN`
      const inserted = await observerClient<{ id: string }[]>`
        INSERT INTO clients(name) VALUES (${CLIENT_NAME}) RETURNING id
      `
      committedClientId = inserted[0].id

      const tracked = track(saveReport(report))
      saving.done = tracked.done

      await wait(waitMs)
      pending = !tracked.isSettled()
    } finally {
      await observerClient`COMMIT`
      const settled = await saving.done
      message = settled.err === undefined ? '（throw しなかった）' : (settled.err as Error).message
    }

    const clientRows = await clientsByPrefix(PREFIX)
    const projectRows = await projectsByPrefix(PREFIX)

    expect({
      pending,
      message,
      clientNames: clientRows.map((row) => row.name),
      projectClientIsCommittedOne:
        projectRows.length === 1 && projectRows[0].clientId === committedClientId,
    }).toEqual({
      pending: true,
      message: '（throw しなかった）',
      clientNames: [CLIENT_NAME],
      projectClientIsCommittedOne: true,
    })
  })
})
