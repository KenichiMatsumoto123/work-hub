/**
 * 日報読み込みの純粋関数（設計書「純粋関数の配置」）
 */
import { defaultDailyReport } from './defaults'
import type { DailyReportData, Project, Task } from './types'
import {
  isValidReportDate,
  isValidReportStructure,
} from '~/server/report-normalize'

export const DATE_CHANGE_CONFIRM =
  '入力内容が保存されていません。日付を切り替えますか？'
export const LEAVE_PAGE_CONFIRM =
  '入力内容が保存されていません。このページを離れますか？'
export const LOAD_STATUS_LOADING = '読み込み中…'
export const LOAD_STATUS_ERROR = '読み込みに失敗しました'
export const LOGIN_ON_401_HREF = '/login?redirect=/'

export type LoadStatus = 'loading' | 'ready' | 'error'

export type ReportLoadState = {
  data: DailyReportData
  baseline: DailyReportData
  loadStatus: LoadStatus
  loadRequestId: number
}

/** AC-L30 / L42 / L46 の操作可否（振る舞い契約） */
export type FormControlsAccessibility = {
  dateEnabled: boolean
  retryEnabled: boolean
  formLocked: boolean
}

export type StartLoadDeps = {
  getByDate: (date: string) => Promise<DailyReportData | null>
  assignLocation?: (href: string) => void
  onBeforeFetch?: (state: ReportLoadState) => void
}

export type DateChangeResult =
  | { action: 'none'; state: ReportLoadState }
  | { action: 'startLoad'; date: string; state: ReportLoadState }

/** stale 応答の確定用：モジュールレベルで現行 requestId と最新 state を保持 */
let currentLoadRequestId = 0
let latestCommittedState: ReportLoadState | null = null

function compareTasks(a: Task, b: Task): boolean {
  return (
    a.label === b.label &&
    a.name === b.name &&
    a.plannedHours === b.plannedHours &&
    a.actualHours === b.actualHours &&
    a.progressBefore === b.progressBefore &&
    a.progressExpected === b.progressExpected &&
    a.progressActual === b.progressActual
  )
}

function compareProjects(a: Project, b: Project): boolean {
  if (a.name !== b.name || a.plannedHours !== b.plannedHours) return false
  if (a.tasks.length !== b.tasks.length) return false
  for (let i = 0; i < a.tasks.length; i++) {
    if (!compareTasks(a.tasks[i], b.tasks[i])) return false
  }
  return true
}

export function isReportDirty(
  current: DailyReportData,
  baseline: DailyReportData,
): boolean {
  if (current.date !== baseline.date) return true
  if (current.startTime !== baseline.startTime) return true
  if (current.endTime !== baseline.endTime) return true
  if (current.breakTime !== baseline.breakTime) return true
  if (current.note !== baseline.note) return true
  if (current.goodPoints !== baseline.goodPoints) return true
  if (current.badPoints !== baseline.badPoints) return true
  if (current.nextPlan !== baseline.nextPlan) return true
  if (current.projects.length !== baseline.projects.length) return true
  for (let i = 0; i < current.projects.length; i++) {
    if (!compareProjects(current.projects[i], baseline.projects[i])) return true
  }
  return false
}

export function emptyReport(date: string): DailyReportData {
  return defaultDailyReport(date)
}

function checkUnauthorizedValue(value: unknown, visited: Set<object>): boolean {
  if (value === null || value === undefined) return false

  if (value instanceof Response && value.status === 401) return true

  if (value instanceof Error && value.message.includes('UNAUTHORIZED')) return true

  if (typeof value === 'string' && value.includes('UNAUTHORIZED')) return true

  if (typeof value === 'object') {
    if (visited.has(value)) return false
    visited.add(value)

    const obj = value as Record<string, unknown>

    if (obj.status === 401) return true

    if (typeof obj.message === 'string' && obj.message.includes('UNAUTHORIZED')) {
      return true
    }

    if ('cause' in obj && checkUnauthorizedValue(obj.cause, visited)) return true
    if ('error' in obj && checkUnauthorizedValue(obj.error, visited)) return true
    if ('response' in obj && checkUnauthorizedValue(obj.response, visited)) {
      return true
    }
  }

  return false
}

export function isUnauthorizedError(error: unknown): boolean {
  return checkUnauthorizedValue(error, new Set())
}

export function shouldFetchReport(date: string): boolean {
  return isValidReportDate(date)
}

export function applyLoadSuccess(
  date: string,
  report: DailyReportData | null,
): DailyReportData {
  if (report === null) return emptyReport(date)
  return { ...report, date }
}

export function shouldPreventUnload(
  dirty: boolean,
  loadStatus: LoadStatus,
): boolean {
  if (loadStatus === 'error') return true
  if (loadStatus === 'ready' && dirty) return true
  return false
}

/** AC-L51 / L56：SPA 内ヘッダー遷移 confirm（shouldPreventUnload とは別契約） */
export function shouldConfirmSpaLeave(
  dirty: boolean,
  loadStatus: LoadStatus,
): boolean {
  return dirty && (loadStatus === 'ready' || loadStatus === 'error')
}

/** AC-L55：保存成功後に baseline を data に揃える */
export function markReportSaved(state: ReportLoadState): ReportLoadState {
  return {
    ...state,
    baseline: state.data,
    loadStatus: 'ready',
  }
}

export function isLoadableReport(value: unknown): boolean {
  return isValidReportStructure(value)
}

/** loading / error / ready 時の操作可否（AC-L30 / L42 / L46） */
export function getFormControlsAccessibility(
  loadStatus: LoadStatus,
): FormControlsAccessibility {
  if (loadStatus === 'loading') {
    return { dateEnabled: false, retryEnabled: false, formLocked: true }
  }
  if (loadStatus === 'error') {
    return { dateEnabled: true, retryEnabled: true, formLocked: true }
  }
  return { dateEnabled: true, retryEnabled: false, formLocked: false }
}

function commitState(state: ReportLoadState, requestId: number): ReportLoadState {
  latestCommittedState = state
  currentLoadRequestId = requestId
  return state
}

function staleResult(): ReportLoadState {
  return latestCommittedState!
}

/**
 * 読み込み開始〜応答確定（設計書 startLoad 8 ステップ）
 */
export async function startLoad(
  state: ReportLoadState,
  date: string,
  deps: StartLoadDeps,
): Promise<ReportLoadState> {
  const requestId = state.loadRequestId + 1
  currentLoadRequestId = requestId

  let workingState: ReportLoadState = {
    ...state,
    loadRequestId: requestId,
    loadStatus: 'loading',
  }

  if (!shouldFetchReport(date)) {
    const empty = emptyReport('')
    return commitState(
      {
        ...workingState,
        data: empty,
        baseline: empty,
        loadStatus: 'ready',
      },
      requestId,
    )
  }

  workingState = {
    ...workingState,
    data: { ...workingState.data, date },
  }
  deps.onBeforeFetch?.(workingState)

  try {
    const report = await deps.getByDate(date)

    if (requestId !== currentLoadRequestId) {
      return staleResult()
    }

    if (isUnauthorizedError(report)) {
      deps.assignLocation?.(LOGIN_ON_401_HREF)
      return workingState
    }

    if (report !== null && !isLoadableReport(report)) {
      return commitState(
        {
          ...workingState,
          loadStatus: 'error',
        },
        requestId,
      )
    }

    const loaded = applyLoadSuccess(date, report)
    return commitState(
      {
        ...workingState,
        data: loaded,
        baseline: loaded,
        loadStatus: 'ready',
      },
      requestId,
    )
  } catch (error) {
    if (requestId !== currentLoadRequestId) {
      return staleResult()
    }

    if (isUnauthorizedError(error)) {
      deps.assignLocation?.(LOGIN_ON_401_HREF)
      return workingState
    }

    return commitState(
      {
        ...workingState,
        loadStatus: 'error',
      },
      requestId,
    )
  }
}

/** 日付変更の分岐（設計書「日付変更」1〜4） */
export function onDateChange(
  state: ReportLoadState,
  nextDate: string,
  deps: { confirm: (message: string) => boolean },
): DateChangeResult {
  if (nextDate === state.data.date) {
    return { action: 'none', state }
  }

  if (isReportDirty(state.data, state.baseline)) {
    if (!deps.confirm(DATE_CHANGE_CONFIRM)) {
      return { action: 'none', state }
    }
  }

  return { action: 'startLoad', date: nextDate, state }
}
