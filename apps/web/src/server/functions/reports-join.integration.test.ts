/**
 * 工数実績の正規化保存：DB込み結合テスト（テスト観点表 1.3 実 JOIN クエリ）
 *
 * 対象観点：3-1・3-2・3-3・3-4・3-5・3-6・3-7・3-8（3-9 は対象外）
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { clients, projects, tasks } from '../schema'
import { makeProject, makeReport, makeSingleBlockReport, makeTask } from '../../test/report-builders'
import {
  assertDatesAreReal,
  cleanup,
  clientNamesByPrefix,
  clientsByPrefix,
  entryCountForTasksByPrefix,
  entriesWithTaskOfDate,
  entrySummaryOfDate,
  errorMessageOf,
  projectsByPrefix,
  saveReport,
  taskTitlesByPrefix,
  tasksByPrefix,
  testDb,
} from '../../test/report-db-helpers'

const DATES = [
  '2000-02-08',
  '2000-02-09',
  '2000-02-10',
  '2000-02-11',
  '2000-02-12',
  '2000-02-13',
  '2000-02-14',
  '2000-02-15',
  '2000-02-16',
  '2000-02-17',
  '2000-02-18',
]

beforeAll(async () => {
  await assertDatesAreReal(DATES)
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('3-1 NULL を含む複合キーの一致（AC-49・AC-50）', () => {
  const PREFIX = 'IT0301-'
  const NO_MASTER_DATES = ['2000-02-08', '2000-02-09']
  const CLIENT_ONLY_DATES = ['2000-02-10', '2000-02-11']

  afterEach(() => cleanup(PREFIX, [...NO_MASTER_DATES, ...CLIENT_ONLY_DATES]))

  it('① 取引先もプロジェクトも空の同名タスクは1件に名寄せされ2回目も成功する', async () => {
    const messages: string[] = []
    for (const date of NO_MASTER_DATES) {
      messages.push(
        await errorMessageOf(() =>
          saveReport(
            makeSingleBlockReport(date, '', [
              { label: '', name: `${PREFIX}調査`, actualHours: '1' },
            ]),
          ),
        ),
      )
    }

    expect({
      messages,
      tasks: await taskTitlesByPrefix(PREFIX),
      entries: await entryCountForTasksByPrefix(PREFIX),
    }).toEqual({
      messages: ['（throw しなかった）', '（throw しなかった）'],
      tasks: [`${PREFIX}調査`],
      entries: 2,
    })
  })

  it('② 取引先のみありプロジェクトが空の同名タスクも1件に名寄せされる', async () => {
    const messages: string[] = []
    for (const date of CLIENT_ONLY_DATES) {
      messages.push(
        await errorMessageOf(() =>
          saveReport(
            makeSingleBlockReport(date, `${PREFIX}B社`, [
              { label: '', name: `${PREFIX}会議`, actualHours: '1' },
            ]),
          ),
        ),
      )
    }

    expect({
      messages,
      tasks: await taskTitlesByPrefix(PREFIX),
      entries: await entryCountForTasksByPrefix(PREFIX),
    }).toEqual({
      messages: ['（throw しなかった）', '（throw しなかった）'],
      tasks: [`${PREFIX}会議`],
      entries: 2,
    })
  })
})

describe('3-2 取引先違いの同名 adhoc タスクの分離（AC-20）', () => {
  const DATE = '2000-02-12'
  const PREFIX = 'IT0302-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('取引先が異なれば同名でも別のタスクになる', async () => {
    await saveReport(
      makeReport({
        date: DATE,
        projects: [
          makeProject({
            name: `${PREFIX}A社`,
            tasks: [makeTask({ label: '', name: `${PREFIX}定例会議`, actualHours: '1' })],
          }),
          makeProject({
            name: `${PREFIX}B社`,
            tasks: [makeTask({ label: '', name: `${PREFIX}定例会議`, actualHours: '2' })],
          }),
        ],
      }),
    )

    const clientNameById = new Map((await clientsByPrefix(PREFIX)).map((row) => [row.id, row.name]))
    const taskRows = await tasksByPrefix(PREFIX)

    expect({
      tasks: taskRows
        .map((row) => ({
          title: row.title,
          client: row.clientId ? clientNameById.get(row.clientId) : null,
        }))
        .sort((a, b) => String(a.client).localeCompare(String(b.client))),
      entries: await entrySummaryOfDate(DATE),
    }).toEqual({
      tasks: [
        { title: `${PREFIX}定例会議`, client: `${PREFIX}A社` },
        { title: `${PREFIX}定例会議`, client: `${PREFIX}B社` },
      ],
      entries: { count: 2, total: 3 },
    })
  })
})

describe('3-3 取引先違いの同名プロジェクトの分離（AC-19）', () => {
  const DATE = '2000-02-13'
  const PREFIX = 'IT0303-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('取引先が異なれば同名でも別のプロジェクトになる', async () => {
    await saveReport(
      makeReport({
        date: DATE,
        projects: [
          makeProject({
            name: `${PREFIX}A社`,
            tasks: [
              makeTask({ label: `${PREFIX}基幹刷新`, name: `${PREFIX}作業`, actualHours: '1' }),
            ],
          }),
          makeProject({
            name: `${PREFIX}B社`,
            tasks: [
              makeTask({ label: `${PREFIX}基幹刷新`, name: `${PREFIX}作業`, actualHours: '2' }),
            ],
          }),
        ],
      }),
    )

    const clientNameById = new Map((await clientsByPrefix(PREFIX)).map((row) => [row.id, row.name]))

    expect(
      (await projectsByPrefix(PREFIX))
        .map((row) => ({ name: row.name, client: clientNameById.get(row.clientId) }))
        .sort((a, b) => String(a.client).localeCompare(String(b.client))),
    ).toEqual([
      { name: `${PREFIX}基幹刷新`, client: `${PREFIX}A社` },
      { name: `${PREFIX}基幹刷新`, client: `${PREFIX}B社` },
    ])
  })
})

describe('3-4 名前の正規化による名寄せ（取引先・AC-16）', () => {
  const DATE = '2000-02-14'
  const PREFIX = 'IT0304-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('空白だけが異なる取引先名は同一レコードに解決される', async () => {
    const variants = [
      ` ${PREFIX}A社 `,
      `${PREFIX}A  社`,
      `${PREFIX}A　社`,
      `${PREFIX}A\t社`,
      `${PREFIX}A社`,
      `${PREFIX}A 社`,
    ]

    await saveReport(
      makeReport({
        date: DATE,
        projects: variants.map((name, index) =>
          makeProject({
            name,
            tasks: [makeTask({ label: '', name: `${PREFIX}行${index + 1}`, actualHours: '1' })],
          }),
        ),
      }),
    )

    expect(await clientNamesByPrefix(PREFIX)).toEqual([`${PREFIX}A 社`, `${PREFIX}A社`])
  })
})

describe('3-5 正規化しない差異（大小文字・全角半角・AC-17・AC-18）', () => {
  const DATE = '2000-02-15'
  const PREFIX = 'IT0305-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('大小文字・全角半角が異なる取引先名は別レコードになる', async () => {
    const variants = [`${PREFIX}abc商事`, `${PREFIX}ABC商事`, `${PREFIX}ＡＢＣ商事`]

    await saveReport(
      makeReport({
        date: DATE,
        projects: variants.map((name, index) =>
          makeProject({
            name,
            tasks: [makeTask({ label: '', name: `${PREFIX}行${index + 1}`, actualHours: '1' })],
          }),
        ),
      }),
    )

    expect(await clientNamesByPrefix(PREFIX)).toEqual([
      `${PREFIX}ABC商事`,
      `${PREFIX}abc商事`,
      `${PREFIX}ＡＢＣ商事`,
    ])
  })
})

describe('3-6 名前の正規化による名寄せ（プロジェクト・タスク・AC-51・AC-52）', () => {
  const DATE = '2000-02-16'
  const PREFIX = 'IT0306-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('空白だけが異なるプロジェクト名・タスク名は同一レコードに解決される', async () => {
    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: ` ${PREFIX}基幹刷新 `, name: `${PREFIX}調査 `, actualHours: '1' },
        { label: `${PREFIX}基幹刷新`, name: `${PREFIX}調査`, actualHours: '2' },
      ]),
    )

    expect({
      projects: (await projectsByPrefix(PREFIX)).map((row) => row.name),
      tasks: await taskTitlesByPrefix(PREFIX),
      entries: await entrySummaryOfDate(DATE),
    }).toEqual({
      projects: [`${PREFIX}基幹刷新`],
      tasks: [`${PREFIX}調査`],
      entries: { count: 2, total: 3 },
    })
  })
})

describe('3-7 論理削除済みリレーションの再利用（AC-57・AC-21）', () => {
  const DATE = '2000-02-17'
  const PREFIX = 'IT0307-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('アーカイブ済み・完了済みのレコードも状態を変えずに再利用される', async () => {
    const [client] = await testDb
      .insert(clients)
      .values({ name: `${PREFIX}A社`, isArchived: true })
      .returning({ id: clients.id })
    const [project] = await testDb
      .insert(projects)
      .values({ clientId: client.id, name: `${PREFIX}基幹刷新`, isArchived: true })
      .returning({ id: projects.id })
    const existing = await testDb
      .insert(tasks)
      .values([
        {
          type: 'project',
          title: `${PREFIX}調査`,
          status: 'archived',
          clientId: client.id,
          projectId: project.id,
        },
        {
          type: 'project',
          title: `${PREFIX}実装`,
          status: 'completed',
          clientId: client.id,
          projectId: project.id,
        },
      ])
      .returning({ id: tasks.id })
    const existingIds = existing.map((row) => row.id).sort()

    await saveReport(
      makeSingleBlockReport(DATE, `${PREFIX}A社`, [
        { label: `${PREFIX}基幹刷新`, name: `${PREFIX}調査`, actualHours: '1' },
        { label: `${PREFIX}基幹刷新`, name: `${PREFIX}実装`, actualHours: '2' },
      ]),
    )

    const entries = await entriesWithTaskOfDate(DATE)

    expect({
      clients: (await clientsByPrefix(PREFIX)).map((row) => ({
        name: row.name,
        isArchived: row.isArchived,
      })),
      projects: (await projectsByPrefix(PREFIX)).map((row) => ({
        name: row.name,
        isArchived: row.isArchived,
      })),
      tasks: (await tasksByPrefix(PREFIX))
        .map((row) => ({ title: row.title, status: row.status }))
        .sort((a, b) => a.title.localeCompare(b.title)),
      entryTaskIds: [...new Set(entries.map((row) => row.taskId))].sort(),
    }).toEqual({
      clients: [{ name: `${PREFIX}A社`, isArchived: true }],
      projects: [{ name: `${PREFIX}基幹刷新`, isArchived: true }],
      tasks: [
        { title: `${PREFIX}実装`, status: 'completed' },
        { title: `${PREFIX}調査`, status: 'archived' },
      ],
      entryTaskIds: existingIds,
    })
  })
})

describe('3-8 リレーション先が 0 件（AC-06・AC-27）', () => {
  const DATE = '2000-02-18'
  const PREFIX = 'IT0308-'

  afterEach(() => cleanup(PREFIX, [DATE]))

  it('実績h が有効な行が無ければマスタも実績も作られない', async () => {
    const message = await errorMessageOf(() =>
      saveReport(
        makeSingleBlockReport(DATE, `${PREFIX}A社`, [
          { label: `${PREFIX}PJ`, name: `${PREFIX}予定のみ`, actualHours: '' },
        ]),
      ),
    )

    expect({
      message,
      entries: await entrySummaryOfDate(DATE),
      clients: await clientNamesByPrefix(PREFIX),
      projects: (await projectsByPrefix(PREFIX)).length,
      tasks: await taskTitlesByPrefix(PREFIX),
    }).toEqual({
      message: '（throw しなかった）',
      entries: { count: 0, total: 0 },
      clients: [],
      projects: 0,
      tasks: [],
    })
  })
})
