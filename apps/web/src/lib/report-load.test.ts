/**
 * 日報読み込み純粋関数の単体テスト（AC-L15 / L20〜L24 / L44 / L45 / L50〜L54）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  applyLoadSuccess,
  DATE_CHANGE_CONFIRM,
  emptyReport,
  isLoadableReport,
  isReportDirty,
  isUnauthorizedError,
  LEAVE_PAGE_CONFIRM,
  LOAD_STATUS_ERROR,
  LOAD_STATUS_LOADING,
  LOGIN_ON_401_HREF,
  shouldConfirmSpaLeave,
  shouldFetchReport,
  shouldPreventUnload,
} from './report-load'
import { defaultDailyReport } from './defaults'
import { makeProject, makeReport, makeSingleBlockReport, makeTask } from '../test/report-builders'
import type { DailyReportData } from './types'

beforeEach(() => {
  vi.clearAllMocks()
})

/** 空初期値（id 除外）。設計書 emptyReport = defaultDailyReport(date) の契約 */
function expectEmptyReport(report: DailyReportData, date: string): void {
  expect(report.date).toBe(date)
  expect(report.startTime).toBe('9:00')
  expect(report.endTime).toBe('18:00')
  expect(report.breakTime).toBe('1:00')
  expect(report.note).toBe('')
  expect(report.goodPoints).toBe('')
  expect(report.badPoints).toBe('')
  expect(report.nextPlan).toBe('')
  expect(report.projects).toHaveLength(1)
  expect(report.projects[0].name).toBe('')
  expect(report.projects[0].plannedHours).toBe('')
  expect(report.projects[0].tasks).toHaveLength(1)
  const task = report.projects[0].tasks[0]
  expect(task.label).toBe('')
  expect(task.name).toBe('')
  expect(task.plannedHours).toBe('')
  expect(task.actualHours).toBe('')
  expect(task.progressBefore).toBe('')
  expect(task.progressExpected).toBe('')
  expect(task.progressActual).toBe('')
}

function baselineReport(): ReturnType<typeof defaultDailyReport> {
  return defaultDailyReport('2000-04-21')
}

describe('AC-L15 applyLoadSuccess / emptyReport', () => {
  it('report が null なら emptyReport(D) と同じ初期値になる', () => {
    const date = '2000-04-21'
    expectEmptyReport(applyLoadSuccess(date, null), date)
  })

  it('非 null なら戻り値の date は必ず要求日付 D である', () => {
    const saved = makeSingleBlockReport('2000-04-20', 'A社', [
      { label: 'PJ', name: 'タスク', actualHours: '1' },
    ])
    expect(applyLoadSuccess('2000-04-21', saved).date).toBe('2000-04-21')
  })
})

describe('AC-L20〜L24 isReportDirty', () => {
  it('同一内容（id だけ違う）なら false', () => {
    const a = baselineReport()
    const b = {
      ...a,
      projects: [
        makeProject({
          ...a.projects[0],
          id: 'other-project-id',
          tasks: [{ ...a.projects[0].tasks[0], id: 'other-task-id' }],
        }),
      ],
    }
    expect(isReportDirty(a, b)).toBe(false)
  })

  it.each([
    ['note', { note: 'x' }],
    ['startTime', { startTime: '9:01' }],
    ['endTime', { endTime: '18:01' }],
    ['breakTime', { breakTime: '1:01' }],
    ['goodPoints', { goodPoints: 'x' }],
    ['badPoints', { badPoints: 'x' }],
    ['nextPlan', { nextPlan: 'x' }],
    ['date', { date: '2000-04-22' }],
  ] as const)('ルート %s を1文字変えると true', (_field, patch) => {
    const base = baselineReport()
    const current = { ...base, ...patch }
    expect(isReportDirty(current, base)).toBe(true)
  })

  it('projects[0].name を変えると true', () => {
    const base = baselineReport()
    const current = {
      ...base,
      projects: [makeProject({ ...base.projects[0], name: '変更' })],
    }
    expect(isReportDirty(current, base)).toBe(true)
  })

  it('projects[0].tasks[0].actualHours を変えると true', () => {
    const base = baselineReport()
    const current = {
      ...base,
      projects: [
        makeProject({
          ...base.projects[0],
          tasks: [makeTask({ ...base.projects[0].tasks[0], actualHours: '1' })],
        }),
      ],
    }
    expect(isReportDirty(current, base)).toBe(true)
  })

  it('空白1つ追加も dirty になる', () => {
    const base = baselineReport()
    const current = { ...base, note: ' ' }
    expect(isReportDirty(current, base)).toBe(true)
  })

  it('開いた直後の空初期値を baseline にしたとき何も変えていなければ false', () => {
    const empty = defaultDailyReport('2000-04-21')
    expect(isReportDirty(empty, empty)).toBe(false)
  })

  it('保存成功直後の baseline と同一なら false、1フィールド変えると true', () => {
    const saved = makeSingleBlockReport('2000-04-21', 'A社', [
      { label: 'PJ', name: 'タスク', actualHours: '1' },
    ])
    expect(isReportDirty(saved, saved)).toBe(false)
    expect(isReportDirty({ ...saved, note: 'x' }, saved)).toBe(true)
  })

  it('id を変えても dirty にならない', () => {
    const base = makeSingleBlockReport('2000-04-21', 'A社', [
      { label: 'PJ', name: 'タスク', actualHours: '1' },
    ])
    const current = {
      ...base,
      projects: [
        makeProject({
          name: 'A社',
          tasks: [makeTask({ label: 'PJ', name: 'タスク', actualHours: '1' })],
        }),
      ],
    }
    expect(isReportDirty(current, base)).toBe(false)
  })

  it('projects 配列長が違えば true', () => {
    const base = baselineReport()
    const current = { ...base, projects: [...base.projects, makeProject()] }
    expect(isReportDirty(current, base)).toBe(true)
  })

  it('tasks 配列長が違えば true', () => {
    const base = baselineReport()
    const current = {
      ...base,
      projects: [
        makeProject({
          ...base.projects[0],
          tasks: [...base.projects[0].tasks, makeTask()],
        }),
      ],
    }
    expect(isReportDirty(current, base)).toBe(true)
  })
})

describe('AC-L44 isUnauthorizedError', () => {
  it('Response status 401 は true', () => {
    expect(isUnauthorizedError(new Response('x', { status: 401 }))).toBe(true)
  })

  it('status 401 を持つオブジェクトは true', () => {
    expect(isUnauthorizedError({ status: 401 })).toBe(true)
  })

  it('message に UNAUTHORIZED を含む Error は true', () => {
    expect(isUnauthorizedError(new Error('UNAUTHORIZED'))).toBe(true)
  })

  it('ネストした cause に 401 があると true', () => {
    expect(
      isUnauthorizedError({ cause: new Response('x', { status: 401 }) }),
    ).toBe(true)
  })

  it('ネストした error に UNAUTHORIZED があると true', () => {
    expect(isUnauthorizedError({ error: new Error('UNAUTHORIZED') })).toBe(true)
  })

  it('ネストした response に 401 があると true', () => {
    expect(
      isUnauthorizedError({ response: { status: 401 } }),
    ).toBe(true)
  })

  it('status 500 は false', () => {
    expect(isUnauthorizedError(new Response('x', { status: 500 }))).toBe(false)
  })

  it('無関係な Error は false', () => {
    expect(isUnauthorizedError(new Error('network failed'))).toBe(false)
  })
})

describe('AC-L12 / L35 / L45 shouldFetchReport / isLoadableReport', () => {
  it.each(['2000-04-21', '2026-08-16'])(
    'shouldFetchReport は有効日付 %s で true',
    (date) => {
      expect(shouldFetchReport(date)).toBe(true)
    },
  )

  it.each(['', '2000-1-1', '2026-02-30', '0000-01-01'])(
    'shouldFetchReport は不正日付 %s で false',
    (date) => {
      expect(shouldFetchReport(date)).toBe(false)
    },
  )

  it('isLoadableReport は正常構造で true', () => {
    const report = makeSingleBlockReport('2000-04-21', 'A社', [
      { label: 'PJ', name: 'タスク', actualHours: '1' },
    ])
    expect(isLoadableReport(report)).toBe(true)
  })

  it('isLoadableReport は null で false', () => {
    expect(isLoadableReport(null)).toBe(false)
  })

  it('isLoadableReport は date 不正で false', () => {
    const bad = makeReport({ date: '2026-02-30', projects: [] })
    expect(isLoadableReport(bad)).toBe(false)
  })
})

describe('AC-L50 / L51 確認ダイアログ定数', () => {
  it('DATE_CHANGE_CONFIRM の文言が設計書どおり', () => {
    expect(DATE_CHANGE_CONFIRM).toBe(
      '入力内容が保存されていません。日付を切り替えますか？',
    )
  })

  it('LEAVE_PAGE_CONFIRM の文言が設計書どおり', () => {
    expect(LEAVE_PAGE_CONFIRM).toBe(
      '入力内容が保存されていません。このページを離れますか？',
    )
  })
})

describe('AC-L54 shouldPreventUnload', () => {
  it('ready かつ dirty なら true', () => {
    expect(shouldPreventUnload(true, 'ready')).toBe(true)
  })

  it('error なら dirty に関わらず true', () => {
    expect(shouldPreventUnload(false, 'error')).toBe(true)
    expect(shouldPreventUnload(true, 'error')).toBe(true)
  })

  it('loading 中は false', () => {
    expect(shouldPreventUnload(true, 'loading')).toBe(false)
  })

  it('ready かつ非 dirty は false', () => {
    expect(shouldPreventUnload(false, 'ready')).toBe(false)
  })
})

describe('AC-L51 / L56 shouldConfirmSpaLeave', () => {
  it.each([
    { loadStatus: 'ready' as const, dirty: true, expected: true },
    { loadStatus: 'error' as const, dirty: true, expected: true },
    { loadStatus: 'loading' as const, dirty: true, expected: false },
    { loadStatus: 'ready' as const, dirty: false, expected: false },
    { loadStatus: 'error' as const, dirty: false, expected: false },
  ])(
    'loadStatus=$loadStatus dirty=$dirty なら $expected',
    ({ loadStatus, dirty, expected }) => {
      expect(shouldConfirmSpaLeave(dirty, loadStatus)).toBe(expected)
    },
  )
})

describe('読み込みバナー定数', () => {
  it('LOAD_STATUS_LOADING の文言が設計書どおり', () => {
    expect(LOAD_STATUS_LOADING).toBe('読み込み中…')
  })

  it('LOAD_STATUS_ERROR の文言が設計書どおり', () => {
    expect(LOAD_STATUS_ERROR).toBe('読み込みに失敗しました')
  })

  it('LOGIN_ON_401_HREF が設計書どおり', () => {
    expect(LOGIN_ON_401_HREF).toBe('/login?redirect=/')
  })
})
