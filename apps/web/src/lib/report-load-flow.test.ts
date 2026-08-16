/**
 * 読み込み分岐の結合（内部）テスト（AC-L30〜L37 / L40〜L46 / L50〜L56）
 * 設計書 startLoad / onDateChange の入出力を検証する（React コンポーネントは対象外）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DailyReportData } from './types'
import {
  DATE_CHANGE_CONFIRM,
  getFormControlsAccessibility,
  isReportDirty,
  LOGIN_ON_401_HREF,
  markReportSaved,
  onDateChange,
  shouldPreventUnload,
  startLoad,
  type DateChangeResult,
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

function readyState(date = '2000-04-21', data?: DailyReportData): ReportLoadState {
  const d = data ?? defaultDailyReport(date)
  return {
    data: d,
    baseline: d,
    loadStatus: 'ready',
    loadRequestId: 0,
  }
}

function loadingState(
  date: string,
  requestId: number,
  data?: DailyReportData,
): ReportLoadState {
  const d = data ?? defaultDailyReport(date)
  return {
    data: { ...d, date },
    baseline: d,
    loadStatus: 'loading',
    loadRequestId: requestId,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function expectStartLoad(
  result: DateChangeResult,
): Extract<DateChangeResult, { action: 'startLoad' }> {
  expect(result.action).toBe('startLoad')
  if (result.action !== 'startLoad') {
    throw new Error('expected startLoad')
  }
  return result
}

describe('AC-L30 / L42 / L46 操作可否（getFormControlsAccessibility）', () => {
  it('loading 中は日付変更不可・再試行不可・フォーム操作不可', () => {
    expect(getFormControlsAccessibility('loading')).toEqual({
      dateEnabled: false,
      retryEnabled: false,
      formLocked: true,
    })
  })

  it('error 中は日付変更可・再試行可・フォーム本体はロック', () => {
    expect(getFormControlsAccessibility('error')).toEqual({
      dateEnabled: true,
      retryEnabled: true,
      formLocked: true,
    })
  })

  it('ready 中は日付変更可・再試行不可・フォーム操作可', () => {
    expect(getFormControlsAccessibility('ready')).toEqual({
      dateEnabled: true,
      retryEnabled: false,
      formLocked: false,
    })
  })
})

describe('startLoad：同期フェーズ・応答確定', () => {
  const saved = makeSingleBlockReport('2000-04-20', 'A社', [
    { label: 'PJ', name: 'タスク', actualHours: '1' },
  ])

  it('await 前に data.date だけ要求日付へ更新し loadStatus は loading', async () => {
    const state = readyState('2000-04-21')
    state.data = { ...state.data, note: '保持' }
    const deferred = createDeferred<DailyReportData | null>()
    const getByDate = vi.fn().mockReturnValue(deferred.promise)
    let observedDuringFetch: ReportLoadState | undefined

    const loadPromise = startLoad(state, '2000-04-22', {
      getByDate,
      onBeforeFetch: (s) => {
        observedDuringFetch = s
      },
    })
    void loadPromise.catch(() => {
      /* Red Phase: startLoad スタブは throw。同期フェーズ観測までの未処理拒否を抑止 */
    })

    expect(observedDuringFetch).toBeDefined()
    expect(observedDuringFetch!.data.date).toBe('2000-04-22')
    expect(observedDuringFetch!.data.note).toBe('保持')
    expect(observedDuringFetch!.loadStatus).toBe('loading')
    expect(getByDate).toHaveBeenCalledWith('2000-04-22')

    deferred.resolve(saved)
    const result = await loadPromise

    expect(result.data.date).toBe('2000-04-22')
    expect(result.data.note).toBe(saved.note)
    expect(result.loadStatus).toBe('ready')
  })

  it.each(['2026-02-30', ''])(
    'invalid / 空日付 %s では API を呼ばず emptyReport("") で ready',
    async (date) => {
      const state = readyState('2000-04-21')
      const getByDate = vi.fn()

      const result = await startLoad(state, date, { getByDate })

      expect(getByDate).not.toHaveBeenCalled()
      expectEmptyReport(result.data, '')
      expectEmptyReport(result.baseline, '')
      expect(result.loadStatus).toBe('ready')
    },
  )

  it('stale 応答は無視し、現行 requestId の応答のみ確定する', async () => {
    const saved21 = makeSingleBlockReport('2000-04-21', 'A社', [
      { label: 'PJ', name: 'タスク', actualHours: '1' },
    ])
    const saved22 = makeSingleBlockReport('2000-04-22', 'B社', [
      { label: 'PJ2', name: 'タスク2', actualHours: '2' },
    ])
    const d1 = createDeferred<DailyReportData | null>()
    const d2 = createDeferred<DailyReportData | null>()
    const getByDate = vi
      .fn()
      .mockReturnValueOnce(d1.promise)
      .mockReturnValueOnce(d2.promise)

    const s0 = readyState('2000-04-20')
    const p1 = startLoad(s0, '2000-04-21', { getByDate })
    const p2 = startLoad(loadingState('2000-04-22', 2, s0.data), '2000-04-22', {
      getByDate,
    })

    d2.resolve(saved22)
    d1.resolve(saved21)

    const [settled1, settled2] = await Promise.allSettled([p1, p2])
    expect(settled2.status).toBe('fulfilled')
    expect(settled1.status).toBe('fulfilled')
    const result2 = (settled2 as PromiseFulfilledResult<ReportLoadState>).value
    const result1 = (settled1 as PromiseFulfilledResult<ReportLoadState>).value

    expect(result2.data.date).toBe('2000-04-22')
    expect(result2.baseline.date).toBe('2000-04-22')
    expect(result2.loadStatus).toBe('ready')
    expect(result1).toEqual(result2)
  })

  it('401 では location.assign し失敗バナー用の error にしない', async () => {
    const assign = vi.fn()
    const state = readyState('2000-04-21')
    const deps: StartLoadDeps = {
      getByDate: vi.fn().mockRejectedValue(
        new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 }),
      ),
      assignLocation: assign,
    }

    const result = await startLoad(state, '2000-04-21', deps)

    expect(assign).toHaveBeenCalledWith(LOGIN_ON_401_HREF)
    expect(result.loadStatus).not.toBe('error')
  })

  it('その他例外では error・内容は維持・日付欄は要求日付', async () => {
    const state = readyState('2000-04-21')
    state.data = { ...state.data, note: '維持', date: '2000-04-22' }
    const result = await startLoad(state, '2000-04-22', {
      getByDate: vi.fn().mockRejectedValue(new Error('network')),
    })

    expect(result.loadStatus).toBe('error')
    expect(result.data.note).toBe('維持')
    expect(result.data.date).toBe('2000-04-22')
  })

  it('null 成功は emptyReport(date) で baseline 更新', async () => {
    const state = readyState('2000-04-21')
    const result = await startLoad(state, '2000-04-22', {
      getByDate: vi.fn().mockResolvedValue(null),
    })

    expectEmptyReport(result.data, '2000-04-22')
    expectEmptyReport(result.baseline, '2000-04-22')
    expect(result.loadStatus).toBe('ready')
  })

  it('loadable 成功は applyLoadSuccess で置換', async () => {
    const state = readyState('2000-04-21')
    const result = await startLoad(state, '2000-04-22', {
      getByDate: vi.fn().mockResolvedValue(saved),
    })

    expect(result.data.date).toBe('2000-04-22')
    expect(result.baseline.date).toBe('2000-04-22')
    expect(result.loadStatus).toBe('ready')
  })

  it('構造不正の戻りは error（空で上書きしない）', async () => {
    const state = readyState('2000-04-21')
    state.data = { ...state.data, note: '維持', date: '2000-04-22' }
    const bad = { date: '2026-02-30', projects: [] } as unknown as DailyReportData
    const result = await startLoad(state, '2000-04-22', {
      getByDate: vi.fn().mockResolvedValue(bad),
    })

    expect(result.loadStatus).toBe('error')
    expect(result.data.note).toBe('維持')
  })
})

describe('AC-L33 日付を保存済み日 D へ切替（未保存なし）', () => {
  it('読み込み成功後 isReportDirty が false かつ data.date が D', async () => {
    const targetDate = '2000-04-01'
    const saved = makeSingleBlockReport(targetDate, 'ITL-E2E-L1-取引先', [
      { label: 'PJ', name: 'タスク', actualHours: '2.5' },
    ])
    const state = readyState('2000-04-11')
    const change = expectStartLoad(onDateChange(state, targetDate, { confirm: vi.fn() }))

    const result = await startLoad(change.state, change.date, {
      getByDate: vi.fn().mockResolvedValue(saved),
    })

    expect(isReportDirty(result.data, result.baseline)).toBe(false)
    expect(result.data.date).toBe(targetDate)
    expect(result.loadStatus).toBe('ready')
  })
})

describe('AC-L34 日付を行なし日 D へ切替（未保存なし）', () => {
  it('読み込み成功後に空初期値・日付欄 D・ready', async () => {
    const targetDate = '2000-04-02'
    const state = readyState('2000-04-11')
    const change = expectStartLoad(onDateChange(state, targetDate, { confirm: vi.fn() }))
    const result = await startLoad(change.state, change.date, {
      getByDate: vi.fn().mockResolvedValue(null),
    })

    expectEmptyReport(result.data, targetDate)
    expectEmptyReport(result.baseline, targetDate)
    expect(result.data.date).toBe(targetDate)
    expect(result.loadStatus).toBe('ready')
  })
})

describe('AC-L41 再試行', () => {
  it('error から startLoad(data.date) で再読み込みし成功すれば dirty false', async () => {
    const targetDate = '2000-04-22'
    const saved = makeSingleBlockReport(targetDate, 'A社', [
      { label: 'PJ', name: 'タスク', actualHours: '1' },
    ])
    const errorState: ReportLoadState = {
      ...readyState('2000-04-21'),
      data: { ...defaultDailyReport(targetDate), note: '維持' },
      baseline: defaultDailyReport('2000-04-21'),
      loadStatus: 'error',
      loadRequestId: 1,
    }

    const result = await startLoad(errorState, errorState.data.date, {
      getByDate: vi.fn().mockResolvedValue(saved),
    })

    expect(isReportDirty(result.data, result.baseline)).toBe(false)
    expect(result.data.date).toBe(targetDate)
    expect(result.loadStatus).toBe('ready')
  })
})

describe('AC-L46 error 中の日付変更・再試行', () => {
  it('error かつ dirty なら confirm 後に変更先で startLoad', async () => {
    const targetDate = '2000-04-12'
    const errorState: ReportLoadState = {
      ...readyState('2000-04-11'),
      data: {
        ...defaultDailyReport('2000-04-11'),
        projects: [{ ...defaultDailyReport().projects[0], name: 'x' }],
      },
      loadStatus: 'error',
      loadRequestId: 1,
    }
    const confirm = vi.fn(() => true)
    const change = onDateChange(errorState, targetDate, { confirm })

    expect(confirm).toHaveBeenCalledWith(DATE_CHANGE_CONFIRM)
    const started = expectStartLoad(change)

    const result = await startLoad(started.state, started.date, {
      getByDate: vi.fn().mockResolvedValue(null),
    })
    expectEmptyReport(result.data, targetDate)
    expect(result.loadStatus).toBe('ready')
  })
})

describe('onDateChange（AC-L50 / L52）', () => {
  it('dirty かつ confirm が false なら API 非呼び出し・状態維持', () => {
    const state = readyState('2000-04-11')
    state.data = {
      ...state.data,
      projects: [{ ...state.data.projects[0], name: 'x' }],
    }
    const confirm = vi.fn(() => false)
    const result = onDateChange(state, '2000-04-12', { confirm })

    expect(confirm).toHaveBeenCalledWith(DATE_CHANGE_CONFIRM)
    expect(result.action).toBe('none')
    expect(result.state.data.date).toBe('2000-04-11')
  })

  it('非 dirty では confirm せず startLoad する', () => {
    const state = readyState('2000-04-11')
    const confirm = vi.fn()
    const result = onDateChange(state, '2000-04-12', { confirm })

    expect(confirm).not.toHaveBeenCalled()
    expect(expectStartLoad(result).date).toBe('2000-04-12')
  })

  it('AC-L50 dirty かつ confirm が true なら変更先で startLoad', async () => {
    const state = readyState('2000-04-11')
    state.data = {
      ...state.data,
      projects: [{ ...state.data.projects[0], name: 'x' }],
    }
    const confirm = vi.fn(() => true)
    const change = onDateChange(state, '2000-04-12', { confirm })

    expect(confirm).toHaveBeenCalledWith(DATE_CHANGE_CONFIRM)
    const started = expectStartLoad(change)

    const result = await startLoad(started.state, started.date, {
      getByDate: vi.fn().mockResolvedValue(null),
    })
    expectEmptyReport(result.data, '2000-04-12')
    expect(result.loadStatus).toBe('ready')
  })
})

describe('AC-L55 保存成功後の dirty 解除', () => {
  it('markReportSaved 後は dirty でなく日付変更 confirm も離脱 confirm も出ない', () => {
    const dirtyState = readyState('2000-04-11')
    dirtyState.data = {
      ...dirtyState.data,
      projects: [{ ...dirtyState.data.projects[0], name: '編集済み' }],
    }

    const afterSave = markReportSaved(dirtyState)

    expect(isReportDirty(afterSave.data, afterSave.baseline)).toBe(false)
    expect(
      shouldPreventUnload(
        isReportDirty(afterSave.data, afterSave.baseline),
        afterSave.loadStatus,
      ),
    ).toBe(false)

    const confirm = vi.fn()
    const change = onDateChange(afterSave, '2000-04-12', { confirm })
    expect(confirm).not.toHaveBeenCalled()
    expect(change.action).toBe('startLoad')
  })
})

describe('AC-L31 相当：オープン時の保存済み読み込み', () => {
  it('成功後 isReportDirty が false になる', async () => {
    const saved = makeSingleBlockReport('2000-04-10', 'ITL-E2E-L7-取引先', [
      { label: 'PJ', name: 'タスク', actualHours: '3' },
    ])
    const state = readyState('2000-04-10')
    const result = await startLoad(state, '2000-04-10', {
      getByDate: vi.fn().mockResolvedValue(saved),
    })

    expect(isReportDirty(result.data, result.baseline)).toBe(false)
    expect(result.loadStatus).toBe('ready')
  })
})
