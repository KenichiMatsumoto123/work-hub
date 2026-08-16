/**
 * 読み込み分岐の結合（内部）テスト（AC-L30〜L37 / L40〜L46 / L50〜L56）
 * startLoad 相当の純粋手順をモックで検証する（React コンポーネントは対象外）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DailyReportData } from './types'
import {
  beginStartLoad,
  DATE_CHANGE_CONFIRM,
  emptyReport,
  finalizeStartLoad,
  FORM_CONTROLS,
  getDisabledControls,
  getErrorEnabledControls,
  handleDateChange,
  isReportDirty,
  LEAVE_PAGE_CONFIRM,
  runStartLoad,
  shouldConfirmDateChange,
  shouldConfirmLeavePage,
  shouldConfirmTabSwitch,
  type ReportLoadState,
  type StartLoadDeps,
} from './report-load'
import { defaultDailyReport } from './defaults'
import { makeSingleBlockReport } from '../test/report-builders'

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

function initialState(date = '2000-04-21'): ReportLoadState {
  const empty = emptyReport(date)
  return {
    data: empty,
    baseline: empty,
    loadStatus: 'loading',
    loadRequestId: 0,
  }
}

describe('AC-L30 loading 中の disabled 集合', () => {
  it('loading 中は日付欄を含む全コントロールが disabled', () => {
    const disabled = getDisabledControls('loading')
    for (const control of FORM_CONTROLS) {
      expect(disabled.has(control)).toBe(true)
    }
  })

  it('ready 中はコントロールが disabled にならない', () => {
    const disabled = getDisabledControls('ready')
    expect(disabled.size).toBe(0)
  })
})

describe('AC-L46 error 中の操作可能コントロール', () => {
  it('error 中は日付欄と再試行のみ操作可能', () => {
    const enabled = getErrorEnabledControls()
    expect(enabled.has('date')).toBe(true)
    expect(enabled.has('saveReport')).toBe(false)
    expect(enabled.has('projectInput')).toBe(false)
  })
})

describe('beginStartLoad：日付先行更新（F-A3-001）', () => {
  it('await 前に data.date だけ要求日付へ更新し loadStatus は loading', () => {
    const state = initialState('2000-04-21')
    state.data = { ...state.data, note: '保持' }
    const { state: next, effects } = beginStartLoad(state, '2000-04-22')

    expect(next.data.date).toBe('2000-04-22')
    expect(next.data.note).toBe('保持')
    expect(next.loadStatus).toBe('loading')
    expect(effects).toEqual([{ type: 'getByDate', date: '2000-04-22', requestId: 1 }])
  })

  it('invalid date では API を呼ばず emptyReport("") で ready', () => {
    const state = initialState('2000-04-21')
    const { state: next, effects } = beginStartLoad(state, '2026-02-30')

    expect(effects).toEqual([])
    expectEmptyReport(next.data, '')
    expectEmptyReport(next.baseline, '')
    expect(next.loadStatus).toBe('ready')
  })
})

describe('finalizeStartLoad：stale 応答・401・失敗・成功', () => {
  const saved = makeSingleBlockReport('2000-04-20', 'A社', [
    { label: 'PJ', name: 'タスク', actualHours: '1' },
  ])

  it('stale 応答は無視し、現行 requestId の応答のみ確定する', async () => {
    const saved = makeSingleBlockReport('2000-04-20', 'A社', [
      { label: 'PJ', name: 'タスク', actualHours: '1' },
    ])
    const state: ReportLoadState = {
      data: { ...saved, date: '2000-04-22' },
      baseline: saved,
      loadStatus: 'loading',
      loadRequestId: 2,
    }
    const deps: StartLoadDeps = { getByDate: vi.fn().mockResolvedValue(saved) }

    const stale = await finalizeStartLoad(state, '2000-04-21', 1, deps)
    expect(stale).toEqual(state)

    const fresh = await finalizeStartLoad(state, '2000-04-22', 2, deps)
    expect(fresh.data.date).toBe('2000-04-22')
    expect(fresh.baseline.date).toBe('2000-04-22')
    expect(fresh.loadStatus).toBe('ready')
  })

  it('401 では location.assign し失敗バナー用の error にしない', async () => {
    const assign = vi.fn()
    const state = initialState('2000-04-21')
    state.loadRequestId = 1
    const deps: StartLoadDeps = {
      getByDate: vi.fn(),
      assignLocation: assign,
    }
    const err = new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 })
    const result = await finalizeStartLoad(state, '2000-04-21', 1, deps, err)

    expect(assign).toHaveBeenCalledWith('/login?redirect=/')
    expect(result.loadStatus).not.toBe('error')
  })

  it('その他例外では error・内容は維持・日付欄は要求日付', async () => {
    const state = initialState('2000-04-21')
    state.data = { ...state.data, note: '維持', date: '2000-04-22' }
    state.loadRequestId = 1
    const result = await finalizeStartLoad(
      state,
      '2000-04-22',
      1,
      { getByDate: vi.fn() },
      new Error('network'),
    )

    expect(result.loadStatus).toBe('error')
    expect(result.data.note).toBe('維持')
    expect(result.data.date).toBe('2000-04-22')
  })

  it('null 成功は emptyReport(date) で baseline 更新', async () => {
    const state = initialState('2000-04-21')
    state.loadRequestId = 1
    const result = await finalizeStartLoad(state, '2000-04-22', 1, {
      getByDate: vi.fn().mockResolvedValue(null),
    })

    expectEmptyReport(result.data, '2000-04-22')
    expectEmptyReport(result.baseline, '2000-04-22')
    expect(result.loadStatus).toBe('ready')
  })

  it('loadable 成功は applyLoadSuccess で置換', async () => {
    const state = initialState('2000-04-21')
    state.loadRequestId = 1
    const result = await finalizeStartLoad(state, '2000-04-22', 1, {
      getByDate: vi.fn().mockResolvedValue(saved),
    })

    expect(result.data.date).toBe('2000-04-22')
    expect(result.baseline.date).toBe('2000-04-22')
    expect(result.loadStatus).toBe('ready')
  })

  it('構造不正の戻りは error（空で上書きしない）', async () => {
    const state = initialState('2000-04-21')
    state.data = { ...state.data, note: '維持', date: '2000-04-22' }
    state.loadRequestId = 1
    const bad = { date: '2026-02-30', projects: [] } as unknown as DailyReportData
    const result = await finalizeStartLoad(state, '2000-04-22', 1, {
      getByDate: vi.fn().mockResolvedValue(bad),
    })

    expect(result.loadStatus).toBe('error')
    expect(result.data.note).toBe('維持')
  })
})

describe('handleDateChange（AC-L50 / L52）', () => {
  it('dirty かつ confirm が false なら API 非呼び出し・状態維持', () => {
    const state = initialState('2000-04-11')
    state.loadStatus = 'ready'
    state.data = { ...state.data, projects: [{ ...state.data.projects[0], name: 'x' }] }
    const confirm = vi.fn(() => false)
    const result = handleDateChange(state, '2000-04-12', { confirm })

    expect(confirm).toHaveBeenCalledWith(DATE_CHANGE_CONFIRM)
    expect(result.action).toBe('none')
    expect(result.state.data.date).toBe('2000-04-11')
  })

  it('非 dirty では confirm せず startLoad する', () => {
    const state = initialState('2000-04-11')
    state.loadStatus = 'ready'
    const confirm = vi.fn()
    const result = handleDateChange(state, '2000-04-12', { confirm })

    expect(confirm).not.toHaveBeenCalled()
    expect(result.action).toBe('startLoad')
    expect(result.date).toBe('2000-04-12')
  })
})

describe('shouldConfirmLeavePage / shouldConfirmTabSwitch（AC-L52 / L53 / L56）', () => {
  it('dirty でないときヘッダー遷移 confirm なし', () => {
    expect(shouldConfirmLeavePage(false, 'ready')).toBe(false)
  })

  it('loading 中はヘッダー遷移 confirm なし', () => {
    expect(shouldConfirmLeavePage(true, 'loading')).toBe(false)
  })

  it('error かつ dirty なら LEAVE_PAGE_CONFIRM', () => {
    expect(shouldConfirmLeavePage(true, 'error')).toBe(true)
  })

  it('入力タブ切替では confirm しない', () => {
    expect(shouldConfirmTabSwitch()).toBe(false)
  })
})

describe('shouldConfirmDateChange', () => {
  it('ready かつ dirty なら日付変更 confirm', () => {
    expect(shouldConfirmDateChange(true, 'ready')).toBe(true)
  })

  it('ready かつ非 dirty なら confirm しない', () => {
    expect(shouldConfirmDateChange(false, 'ready')).toBe(false)
  })
})

describe('runStartLoad 統合', () => {
  it('成功後 isReportDirty が false になる（AC-L31 相当の純粋検証）', async () => {
    const saved = makeSingleBlockReport('2000-04-10', 'ITL-E2E-L7-取引先', [
      {
        label: 'PJ',
        name: 'タスク',
        actualHours: '3',
      },
    ])
    const deps: StartLoadDeps = { getByDate: vi.fn().mockResolvedValue(saved) }
    const state = initialState('2000-04-10')
    const result = await runStartLoad(state, '2000-04-10', deps)

    expect(isReportDirty(result.data, result.baseline)).toBe(false)
    expect(result.loadStatus).toBe('ready')
  })
})

describe('LEAVE_PAGE_CONFIRM 定数の利用', () => {
  it('文言が設計書どおり', () => {
    expect(LEAVE_PAGE_CONFIRM).toBe(
      '入力内容が保存されていません。このページを離れますか？',
    )
  })
})
