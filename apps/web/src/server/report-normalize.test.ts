/**
 * 入力の変換・検証ルール（R-1〜R-7）の単体テスト
 *
 * 根拠：設計書「変換ルール仕様」の R-1〜R-7 と、AC-16〜AC-18・AC-23〜AC-30・AC-35・
 * AC-46・AC-47・AC-48・AC-53・AC-56・AC-66・AC-67・AC-69・AC-73〜AC-78・AC-83〜AC-85。
 * R-2 の期待値は設計書「具体的な分類」表（Phase 5 のテストの根拠として明示されている）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeName,
  toInputString,
  classifyActualHours,
  applyDefaultTaskName,
  resolveTaskIdentity,
  collectLengthViolations,
  isValidReportDate,
  isValidReportStructure,
} from './report-normalize'
import {
  makeProject,
  makeReport,
  makeSingleBlockReport,
  makeTask,
  nameOfLength,
} from '../test/report-builders'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('R-1 normalizeName：空白の正規化', () => {
  it.each([
    ['前後の半角スペースを除去する', ' A社 ', 'A社'],
    ['連続する半角スペースを1つに畳む', 'A  社', 'A 社'],
    ['単独の全角スペースを半角スペース1つにする', 'A　社', 'A 社'],
    ['タブ1文字を半角スペース1つにする', 'A\t社', 'A 社'],
    ['改行を半角スペース1つにする', 'A\n社', 'A 社'],
    ['NBSP を半角スペース1つにする', 'A 社', 'A 社'],
    ['空白の無い名前は変わらない', 'A社', 'A社'],
    ['空白のみの名前は空文字になる', '  \t　', ''],
    ['前後と内部の空白が混在しても1つに畳まれる', '  A 　 社  ', 'A 社'],
  ])('%s', (_label, input, expected) => {
    expect(normalizeName(input)).toBe(expected)
  })

  it.each([
    ['小文字は変換しない', 'abc商事'],
    ['大文字は変換しない', 'ABC商事'],
    ['全角英字は半角化しない', 'ＡＢＣ商事'],
    ['ゼロ幅スペースは畳まない（既知の帰結）', 'A​社'],
  ])('%s', (_label, input) => {
    expect(normalizeName(input)).toBe(input)
  })
})

describe('R-7 toInputString：名前系・実績h の文字列化', () => {
  it.each([
    ['文字列はそのまま', '調査', '調査'],
    ['数値は String() 化する', 123, '123'],
    ['小数も String() 化する', 7.5, '7.5'],
    ['null は空文字にする', null, ''],
    ['undefined は空文字にする', undefined, ''],
    ['オブジェクトは "[object Object]" になる', {}, '[object Object]'],
  ])('%s', (_label, input, expected) => {
    expect(toInputString(input)).toBe(expected)
  })
})

describe('R-2 classifyActualHours：判定 1（parseFloat が NaN）', () => {
  it.each([['', '空文字'], ['   ', '空白のみ'], ['abc', '英字'], ['時間', '日本語'], ['１.５', '全角数字']])(
    '%s（%s）はスキップする',
    (input) => {
      expect(classifyActualHours(input)).toEqual({ kind: 'skip' })
    },
  )
})

describe('R-2 classifyActualHours：判定 2（0.005 未満）', () => {
  it.each([['0'], ['-3'], ['0.004'], ['0.0000001'], ['0x10']])(
    '%s はスキップする',
    (input) => {
      expect(classifyActualHours(input)).toEqual({ kind: 'skip' })
    },
  )
})

describe('R-2 classifyActualHours：判定 3（24.005 以上）', () => {
  it.each([
    ['24.005', 24.005],
    ['25', 25],
    ['1e2', 100],
    ['12345678901234567890', 1.2345678901234567e19],
    ['Infinity', Infinity],
  ])('%s は保存全体のエラーとして扱う', (input, value) => {
    expect(classifyActualHours(input)).toEqual({ kind: 'over', value })
  })
})

describe('R-2 classifyActualHours：判定 4（対象行）', () => {
  it.each([
    ['0.005', 0.005],
    ['7.5h', 7.5],
    ['7.5 時間', 7.5],
    ['1,5', 1],
    ['2.675', 2.675],
    ['24', 24],
    ['24.004', 24.004],
  ])('%s は対象行になる', (input, value) => {
    expect(classifyActualHours(input)).toEqual({ kind: 'target', value })
  })

  it('数値型で届いた実績h も文字列化を経て対象行になる（AC-53）', () => {
    expect(classifyActualHours(7.5)).toEqual({ kind: 'target', value: 7.5 })
  })
})

describe('R-5 applyDefaultTaskName：タスク名の既定値', () => {
  it('正規化後が空文字なら (名称未設定) にする', () => {
    expect(applyDefaultTaskName('')).toBe('(名称未設定)')
  })

  it('タスク名があればそのまま使う', () => {
    expect(applyDefaultTaskName('調査')).toBe('調査')
  })
})

describe('R-4 resolveTaskIdentity：tasks の識別情報', () => {
  it('取引先・プロジェクトがともにあると type=project になる（AC-26）', () => {
    expect(
      resolveTaskIdentity({ clientName: 'A社', projectName: '基幹刷新', taskName: '調査' }),
    ).toEqual({
      type: 'project',
      clientName: 'A社',
      projectName: '基幹刷新',
      title: '調査',
    })
  })

  it('取引先のみだと type=adhoc でプロジェクトを解決しない（AC-24）', () => {
    expect(resolveTaskIdentity({ clientName: 'A社', projectName: '', taskName: '調査' })).toEqual({
      type: 'adhoc',
      clientName: 'A社',
      projectName: null,
      title: '調査',
    })
  })

  it('取引先が空でプロジェクト名があるとタスク名へ連結する（AC-25）', () => {
    expect(
      resolveTaskIdentity({ clientName: '', projectName: '基幹刷新', taskName: '調査' }),
    ).toEqual({
      type: 'adhoc',
      clientName: null,
      projectName: null,
      title: '基幹刷新 / 調査',
    })
  })

  it('取引先・プロジェクトがともに空だとタスク名だけになる（AC-23）', () => {
    expect(resolveTaskIdentity({ clientName: '', projectName: '', taskName: '調査' })).toEqual({
      type: 'adhoc',
      clientName: null,
      projectName: null,
      title: '調査',
    })
  })

  it('名前には R-1 の正規化が適用される（AC-16・AC-51・AC-52）', () => {
    expect(
      resolveTaskIdentity({
        clientName: ' A　社 ',
        projectName: '基幹  刷新',
        taskName: '調査 ',
      }),
    ).toEqual({
      type: 'project',
      clientName: 'A 社',
      projectName: '基幹 刷新',
      title: '調査',
    })
  })

  it('タスク名が空だと (名称未設定) になる（AC-28）', () => {
    expect(resolveTaskIdentity({ clientName: 'A社', projectName: '', taskName: '   ' })).toEqual({
      type: 'adhoc',
      clientName: 'A社',
      projectName: null,
      title: '(名称未設定)',
    })
  })

  it('プロジェクトのみでタスク名が空だと連結後も既定値を使う（AC-28）', () => {
    expect(resolveTaskIdentity({ clientName: '', projectName: '基幹刷新', taskName: '' })).toEqual({
      type: 'adhoc',
      clientName: null,
      projectName: null,
      title: '基幹刷新 / (名称未設定)',
    })
  })

  it('文字列でない名前は String() 化して扱う（AC-69）', () => {
    expect(resolveTaskIdentity({ clientName: 123, projectName: null, taskName: {} })).toEqual({
      type: 'adhoc',
      clientName: '123',
      projectName: null,
      title: '[object Object]',
    })
  })
})

describe('R-6 collectLengthViolations：名前の長さ検証', () => {
  it('255 文字ちょうどは違反にならない', () => {
    const data = makeSingleBlockReport('2000-01-01', 'A社', [
      { label: '基幹刷新', name: nameOfLength(255), actualHours: '1.5' },
    ])

    expect(collectLengthViolations(data)).toEqual([])
  })

  it('256 文字のタスク名は違反になる（AC-38）', () => {
    const title = nameOfLength(256)
    const data = makeSingleBlockReport('2000-01-01', 'A社', [
      { label: '基幹刷新', name: title, actualHours: '1.5' },
    ])

    expect(collectLengthViolations(data)).toEqual([
      { field: 'タスク名', value: title, length: 256 },
    ])
  })

  it('実績h が有効でない行の長い名前は検証しない（AC-48）', () => {
    const data = makeSingleBlockReport('2000-01-01', nameOfLength(300), [
      { label: nameOfLength(300), name: nameOfLength(300), actualHours: '' },
    ])

    expect(collectLengthViolations(data)).toEqual([])
  })

  it('取引先が空の行ではプロジェクト名を検証せず、連結後のタスク名を検証する（AC-66）', () => {
    const projectName = nameOfLength(300)
    const data = makeSingleBlockReport('2000-01-01', '', [
      { label: projectName, name: '調査', actualHours: '1.5' },
    ])

    expect(collectLengthViolations(data)).toEqual([
      { field: 'タスク名', value: `${projectName} / 調査`, length: 305 },
    ])
  })

  it('同一ブロックに対象行が3行あっても取引先名の違反は1回だけ返す（AC-67）', () => {
    const clientName = nameOfLength(300)
    const data = makeSingleBlockReport('2000-01-01', clientName, [
      { label: '基幹刷新', name: '調査1', actualHours: '1' },
      { label: '基幹刷新', name: '調査2', actualHours: '2' },
      { label: '基幹刷新', name: '調査3', actualHours: '3' },
    ])

    expect(collectLengthViolations(data)).toEqual([
      { field: '取引先名', value: clientName, length: 300 },
    ])
  })

  it('同一行に複数の違反があると 取引先名 → プロジェクト名 → タスク名 の順で返す', () => {
    const long = nameOfLength(300)
    const data = makeSingleBlockReport('2000-01-01', long, [
      { label: long, name: long, actualHours: '1.5' },
    ])

    expect(collectLengthViolations(data)).toEqual([
      { field: '取引先名', value: long, length: 300 },
      { field: 'プロジェクト名', value: long, length: 300 },
      { field: 'タスク名', value: long, length: 300 },
    ])
  })

  it('プロジェクトブロックの順・タスク行の順に検出する', () => {
    const first = nameOfLength(256, 'い')
    const second = nameOfLength(256, 'う')
    const data = makeReport({
      projects: [
        makeProject({
          name: 'A社',
          tasks: [makeTask({ label: '基幹刷新', name: first, actualHours: '1' })],
        }),
        makeProject({
          name: 'B社',
          tasks: [makeTask({ label: '基幹刷新', name: second, actualHours: '2' })],
        }),
      ],
    })

    expect(collectLengthViolations(data)).toEqual([
      { field: 'タスク名', value: first, length: 256 },
      { field: 'タスク名', value: second, length: 256 },
    ])
  })
})

describe('R-7 isValidReportDate：日付の検証', () => {
  it.each([
    ['通常の日付', '2026-12-31'],
    ['4 の倍数の閏日（AC-84）', '2028-02-29'],
    ['400 の倍数の閏日（AC-84）', '2000-02-29'],
    ['2 桁年の閏日（AC-85）', '0004-02-29'],
    ['2 桁年の通常日（AC-78）', '0050-03-01'],
    ['年 0001（AC-78）', '0001-01-01'],
  ])('%s は通過する', (_label, input) => {
    expect(isValidReportDate(input)).toBe(true)
  })

  it.each([
    ['書式違反（AC-73）', '2000-1-1'],
    ['実在しない日（AC-74）', '2026-02-30'],
    ['年 0（AC-73）', '0000-01-01'],
    ['月が 13（AC-83）', '2026-13-01'],
    ['月が 00（AC-83）', '2026-00-10'],
    ['日が 00（AC-83）', '2026-01-00'],
    ['4 の倍数でない年の 2/29（AC-84）', '2026-02-29'],
    ['100 の倍数かつ 400 の倍数でない年の 2/29（AC-84）', '1900-02-29'],
    ['2 桁年の非閏年の 2/29（AC-85）', '0050-02-29'],
    ['末尾に改行がある', '2026-12-31\n'],
    ['全角数字', '２０２６-１２-３１'],
    ['空文字', ''],
  ])('%s は拒否する', (_label, input) => {
    expect(isValidReportDate(input)).toBe(false)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['数値', 20261231],
    ['オブジェクト', {}],
  ])('文字列でない %s は拒否する', (_label, input) => {
    expect(isValidReportDate(input)).toBe(false)
  })
})

describe('R-7 isValidReportStructure：入力構造の検証', () => {
  it('正常な日報は通過する', () => {
    const data = makeSingleBlockReport('2026-12-31', 'A社', [
      { label: '基幹刷新', name: '調査', actualHours: '1.5' },
    ])

    expect(isValidReportStructure(data)).toBe(true)
  })

  it('タスク行が 0 件のプロジェクトブロックも通過する（AC-06）', () => {
    expect(isValidReportStructure(makeReport({ projects: [makeProject({ name: 'A社' })] }))).toBe(
      true,
    )
  })

  it.each([
    ['null（AC-76）', null],
    ['undefined', undefined],
    ['文字列', 'not-an-object'],
    ['数値', 123],
    ['配列', []],
  ])('data が %s なら拒否する', (_label, input) => {
    expect(isValidReportStructure(input)).toBe(false)
  })

  it('date が文字列でないと拒否する（AC-41）', () => {
    expect(isValidReportStructure(makeReport({ date: 20261231 as unknown as string }))).toBe(false)
  })

  it('date が実在しない日だと拒否する（AC-74）', () => {
    expect(isValidReportStructure(makeReport({ date: '2026-02-30' }))).toBe(false)
  })

  it('projects が配列でないと拒否する（AC-41）', () => {
    expect(
      isValidReportStructure(makeReport({ projects: 'x' as unknown as never })),
    ).toBe(false)
  })

  it('projects の要素が null だと拒否する（AC-60）', () => {
    expect(isValidReportStructure(makeReport({ projects: [null as unknown as never] }))).toBe(false)
  })

  it('tasks が配列でないと拒否する（AC-41）', () => {
    expect(
      isValidReportStructure(
        makeReport({ projects: [makeProject({ tasks: 'x' as unknown as never })] }),
      ),
    ).toBe(false)
  })

  it('tasks の要素が null だと拒否する（AC-60）', () => {
    expect(
      isValidReportStructure(
        makeReport({ projects: [makeProject({ tasks: [null as unknown as never] })] }),
      ),
    ).toBe(false)
  })
})
