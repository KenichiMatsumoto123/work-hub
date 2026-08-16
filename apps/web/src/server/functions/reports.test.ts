/**
 * saveReportFn / deleteReportFn の結合テスト（内部・DB 不要）
 *
 * 対象：
 * - テスト観点表 1.6 節 6-2：`requireSession` の静的検証
 * - テスト観点表 1.6 節 6-3：エラーメッセージの列挙単位（AC-56・AC-66・AC-67）
 * - エラーメッセージ文言（AC-37・AC-38・AC-41・AC-59・AC-60）
 *
 * 検証エラーはトランザクション開始前に投げられ DB に触れない（AC-36・AC-38）ため、
 * `../db` をモックして「触れたら throw する」形にしてある。DB に触れる実装は
 * ここでメッセージ不一致として落ちる。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DailyReportData } from '~/lib/types'
import {
  makeProject,
  makeReport,
  makeSingleBlockReport,
  makeTask,
  nameOfLength,
} from '../../test/report-builders'

vi.mock('../db', () => {
  const touch = (name: string) => () => {
    throw new Error(`検証エラーの経路で DB に触れました: ${name}`)
  }
  return {
    db: {
      insert: touch('insert'),
      delete: touch('delete'),
      select: touch('select'),
      update: touch('update'),
      execute: touch('execute'),
      transaction: touch('transaction'),
    },
  }
})

const { saveReportFn, getReportByDateFn } = await import('./reports')

beforeEach(() => {
  vi.clearAllMocks()
})

/** throw された Error の message を取り出す（throw しなかった場合も判別できる文字列を返す） */
async function messageOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return '（throw しなかった）'
  } catch (error) {
    return (error as Error).message
  }
}

function save(data: unknown): Promise<unknown> {
  return saveReportFn({ data: data as DailyReportData })
}

const 構造エラー = '日報のデータ形式が不正です。'
const 上限見出し = '実績工数が上限（24時間）を超えています。'
const 長さ見出し = '名前が長すぎます（255文字以内にしてください）。'

// ---------------------------------------------------------------------------
// 6-2 requireSession の静的検証
// ---------------------------------------------------------------------------

/** 行コメント・ブロックコメントを除去する（文字列リテラルの中身は残す） */
function stripComments(source: string): string {
  let out = ''
  let index = 0
  let quote: string | null = null

  while (index < source.length) {
    const ch = source[index]
    const next = source[index + 1]

    if (quote) {
      if (ch === '\\') {
        out += ch + (next ?? '')
        index += 2
        continue
      }
      if (ch === quote) quote = null
      out += ch
      index += 1
      continue
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      out += ch
      index += 1
      continue
    }

    if (ch === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1
      continue
    }

    if (ch === '/' && next === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1
      }
      index += 2
      continue
    }

    out += ch
    index += 1
  }

  return out
}

/**
 * `export const <名前> = createServerFn` から次の `export const`（または EOF）までを
 * 1 定義のスライスとして切り出す。
 */
function sliceServerFnDefinitions(source: string): Map<string, string> {
  const definitions = [...source.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)\s*=\s*createServerFn/g)]
  const boundaries = [...source.matchAll(/export\s+const\s/g)].map((match) => match.index ?? 0)

  const slices = new Map<string, string>()
  for (const definition of definitions) {
    const start = definition.index ?? 0
    const end = boundaries.find((boundary) => boundary > start) ?? source.length
    slices.set(definition[1], source.slice(start, end))
  }
  return slices
}

/**
 * スライスが `requireSession` を要素に含む `.middleware([...])` を持つか。
 * スライス内の `.middleware` 呼び出し全件を走査する（最初の 1 個だけを見ると、
 * それより前に別の `.middleware` 呼び出しがある場合に偽 FAIL になる。FIND-B09）
 */
function hasRequireSessionMiddleware(slice: string): boolean {
  const middlewareCalls = [...slice.matchAll(/\.middleware\(\s*\[([^\]]*)\]\s*\)/g)]
  if (middlewareCalls.length === 0) return false
  return middlewareCalls.some((middleware) =>
    middleware[1]
      .split(',')
      .map((entry) => entry.trim())
      .includes('requireSession'),
  )
}

describe('6-2 requireSession の静的検証', () => {
  const source = stripComments(
    readFileSync(fileURLToPath(new URL('./reports.ts', import.meta.url)), 'utf-8'),
  )
  const slices = sliceServerFnDefinitions(source)

  it('reports.ts から createServerFn の定義を切り出せる（改名・移動での空振りを防ぐ）', () => {
    expect(slices.size).toBeGreaterThan(0)
  })

  it.each(['saveReportFn', 'deleteReportFn', 'getReportByDateFn'])(
    '%s の定義に requireSession を含む .middleware がある',
    (name) => {
      const slice = slices.get(name)

      expect(slice !== undefined && hasRequireSessionMiddleware(slice)).toBe(true)
    },
  )

  it('コメントアウトされた .middleware は検出しない', () => {
    const fake = stripComments(
      [
        'export const saveReportFn = createServerFn({ method: "POST" })',
        '  // .middleware([requireSession])',
        '  .handler(async () => {})',
      ].join('\n'),
    )

    const slice = sliceServerFnDefinitions(fake).get('saveReportFn')

    expect(slice !== undefined && hasRequireSessionMiddleware(slice)).toBe(false)
  })

  it('スライス内に複数の .middleware 呼び出しがあっても後続のものを見る（FIND-B09）', () => {
    const fake = [
      'export const saveReportFn = createServerFn({ method: "POST" })',
      '  .middleware([otherMiddleware])',
      '  .middleware([requireSession])',
      '  .handler(async () => {})',
    ].join('\n')

    const slice = sliceServerFnDefinitions(fake).get('saveReportFn')

    expect(slice !== undefined && hasRequireSessionMiddleware(slice)).toBe(true)
  })

  it('別のサーバー関数の .middleware を自分のものとして数えない', () => {
    const fake = [
      'export const saveReportFn = createServerFn({ method: "POST" })',
      '  .handler(async () => {})',
      'export const deleteReportFn = createServerFn({ method: "POST" })',
      '  .middleware([requireSession])',
      '  .handler(async () => {})',
    ].join('\n')

    const slice = sliceServerFnDefinitions(fake).get('saveReportFn')

    expect(slice !== undefined && hasRequireSessionMiddleware(slice)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 日報の自動読み込み：getReportByDateFn invalid date（AC-L12）
// ---------------------------------------------------------------------------

describe('getReportByDateFn invalid date（AC-L12）', () => {
  it.each(['', '2000-1-1', '2026-02-30', '0000-01-01'])(
    '不正日付 %s では DB に触れず null を返す',
    async (date) => {
      await expect(getReportByDateFn({ data: { date } })).resolves.toBeNull()
    },
  )
})

// ---------------------------------------------------------------------------
// 入力構造の検証（AC-41・AC-60）
// ---------------------------------------------------------------------------

describe('入力構造の検証エラー（AC-41・AC-60）', () => {
  it('projects が配列でないと構造エラーになる', async () => {
    const data = makeReport({ projects: 'not-an-array' as unknown as never })

    expect(await messageOf(() => save(data))).toBe(構造エラー)
  })

  it('tasks が配列でないと構造エラーになる', async () => {
    const data = makeReport({
      projects: [makeProject({ name: 'A社', tasks: 'not-an-array' as unknown as never })],
    })

    expect(await messageOf(() => save(data))).toBe(構造エラー)
  })

  it('date が文字列でないと構造エラーになる', async () => {
    const data = makeReport({ date: 20000101 as unknown as string })

    expect(await messageOf(() => save(data))).toBe(構造エラー)
  })

  it('projects の要素が null でも TypeError にならず構造エラーになる（AC-60）', async () => {
    const data = makeReport({ projects: [null as unknown as never] })

    expect(await messageOf(() => save(data))).toBe(構造エラー)
  })

  it('tasks の要素が null でも TypeError にならず構造エラーになる（AC-60）', async () => {
    const data = makeReport({
      projects: [makeProject({ name: 'A社', tasks: [null as unknown as never] })],
    })

    expect(await messageOf(() => save(data))).toBe(構造エラー)
  })
})

// ---------------------------------------------------------------------------
// 実績h の上限超過（AC-37）
// ---------------------------------------------------------------------------

describe('実績h の上限超過メッセージ（AC-37）', () => {
  it('該当行を見出し1行のあとに全件列挙する', async () => {
    const data = makeSingleBlockReport('2000-01-01', 'A社', [
      { label: '基幹刷新', name: 'ログイン改修', actualHours: '25' },
      { label: '基幹刷新', name: 'バッチ調査', actualHours: '30.5' },
    ])

    expect(await messageOf(() => save(data))).toBe(
      [上限見出し, '「ログイン改修」= 25', '「バッチ調査」= 30.5'].join('\n'),
    )
  })

  it('同じタスク名が複数行にあっても行ごとに列挙する', async () => {
    const data = makeSingleBlockReport('2000-01-01', 'A社', [
      { label: '基幹刷新', name: '調査', actualHours: '25' },
      { label: '基幹刷新', name: '調査', actualHours: '26' },
    ])

    expect(await messageOf(() => save(data))).toBe(
      [上限見出し, '「調査」= 25', '「調査」= 26'].join('\n'),
    )
  })

  it('タスク名は R-4 の連結を適用した最終値で出力する', async () => {
    const data = makeSingleBlockReport('2000-01-01', '', [
      { label: '基幹刷新', name: '調査', actualHours: '25' },
    ])

    expect(await messageOf(() => save(data))).toBe(
      [上限見出し, '「基幹刷新 / 調査」= 25'].join('\n'),
    )
  })

  it('入力値が 30 文字を超える場合は先頭 30 文字に切って出力する', async () => {
    const input = `25${'0'.repeat(38)}`
    const data = makeSingleBlockReport('2000-01-01', 'A社', [
      { label: '基幹刷新', name: '調査', actualHours: input },
    ])

    expect(await messageOf(() => save(data))).toBe(
      [上限見出し, `「調査」= ${input.slice(0, 30)}`].join('\n'),
    )
  })
})

// ---------------------------------------------------------------------------
// 名前の長さ超過（AC-38）と列挙単位（6-3：AC-56・AC-66・AC-67）
// ---------------------------------------------------------------------------

describe('名前の長さ超過メッセージ（AC-38・6-3）', () => {
  it('256 文字のタスク名は項目名・先頭30文字・文字数を出力する', async () => {
    const title = nameOfLength(256)
    const data = makeSingleBlockReport('2000-01-01', 'A社', [
      { label: '基幹刷新', name: title, actualHours: '1.5' },
    ])

    expect(await messageOf(() => save(data))).toBe(
      [長さ見出し, `タスク名: 「${title.slice(0, 30)}」（256文字）`].join('\n'),
    )
  })

  it('取引先空・プロジェクト名 250 文字・タスク名未入力は連結後 260 文字で失敗する（AC-56）', async () => {
    const projectName = nameOfLength(250)
    const title = `${projectName} / (名称未設定)`
    const data = makeSingleBlockReport('2000-01-01', '', [
      { label: projectName, name: '', actualHours: '1.5' },
    ])

    expect(await messageOf(() => save(data))).toBe(
      [長さ見出し, `タスク名: 「${title.slice(0, 30)}」（260文字）`].join('\n'),
    )
  })

  it('取引先空・プロジェクト名 300 文字ではプロジェクト名の行が現れない（AC-66）', async () => {
    const projectName = nameOfLength(300)
    const title = `${projectName} / 調査`
    const data = makeSingleBlockReport('2000-01-01', '', [
      { label: projectName, name: '調査', actualHours: '1.5' },
    ])

    expect(await messageOf(() => save(data))).toBe(
      [長さ見出し, `タスク名: 「${title.slice(0, 30)}」（305文字）`].join('\n'),
    )
  })

  it('同一ブロックに対象行が 3 行あっても取引先名の行は 1 回だけ現れる（AC-67）', async () => {
    const clientName = nameOfLength(300)
    const data = makeSingleBlockReport('2000-01-01', clientName, [
      { label: '基幹刷新', name: '調査1', actualHours: '1' },
      { label: '基幹刷新', name: '調査2', actualHours: '2' },
      { label: '基幹刷新', name: '調査3', actualHours: '3' },
    ])

    expect(await messageOf(() => save(data))).toBe(
      [長さ見出し, `取引先名: 「${clientName.slice(0, 30)}」（300文字）`].join('\n'),
    )
  })

  it.each(['0', '0.004'] as const)(
    '実績h "%s" の 256 文字タスク名は長さ超過テンプレートで失敗する（AC-Z13）',
    async (actualHours) => {
      const title = nameOfLength(256)
      const data = makeSingleBlockReport('2000-01-01', 'A社', [
        { label: '基幹刷新', name: title, actualHours },
      ])

      expect(await messageOf(() => save(data))).toBe(
        [長さ見出し, `タスク名: 「${title.slice(0, 30)}」（256文字）`].join('\n'),
      )
    },
  )

  it('実績h が空でタスク名が 300 文字の行は長さ超過メッセージでは失敗しない（AC-Z14）', async () => {
    const title = nameOfLength(300)
    const data = makeSingleBlockReport('2000-01-01', 'A社', [
      { label: '基幹刷新', name: title, actualHours: '' },
    ])

    expect(await messageOf(() => save(data))).toBe(
      '検証エラーの経路で DB に触れました: transaction',
    )
  })

})

// ---------------------------------------------------------------------------
// 上限超過と長さ超過の同時該当（AC-59）
// ---------------------------------------------------------------------------

describe('上限超過と長さ超過が同時に該当する場合（AC-59）', () => {
  it('上限超過ブロックのあとに長さ超過ブロックを改行1つで連結する', async () => {
    const title = nameOfLength(300)
    const data = makeReport({
      date: '2000-01-01',
      projects: [
        makeProject({
          name: 'A社',
          tasks: [
            makeTask({ label: '基幹刷新', name: 'ログイン改修', actualHours: '25' }),
            makeTask({ label: '基幹刷新', name: title, actualHours: '1.5' }),
          ],
        }),
      ],
    })

    expect(await messageOf(() => save(data))).toBe(
      [
        上限見出し,
        '「ログイン改修」= 25',
        長さ見出し,
        `タスク名: 「${title.slice(0, 30)}」（300文字）`,
      ].join('\n'),
    )
  })
})
