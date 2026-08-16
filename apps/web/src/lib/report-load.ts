/**
 * 日報読み込みの純粋関数（設計書「純粋関数の配置」）
 * Phase 5 Red Phase：シグネチャ＋スタブ最小実装（実ロジック禁止）
 */
import type { DailyReportData } from './types'
import { defaultDailyReport } from './defaults'

export const DATE_CHANGE_CONFIRM =
  '入力内容が保存されていません。日付を切り替えますか？'
export const LEAVE_PAGE_CONFIRM =
  '入力内容が保存されていません。このページを離れますか？'
export const LOAD_STATUS_LOADING = '読み込み中…'
export const LOAD_STATUS_ERROR = '読み込みに失敗しました'
export const LOGIN_ON_401_HREF = '/login?redirect=/'

export type LoadStatus = 'loading' | 'ready' | 'error'

/** AC-L30 で disabled にするコントロール識別子 */
export const FORM_CONTROLS = [
  'date',
  'startTime',
  'endTime',
  'breakTime',
  'projectInput',
  'reflection',
  'saveReport',
  'addClient',
  'tabReport',
  'tabPj',
  'tabAttendance',
  'outputLink',
] as const

export type FormControl = (typeof FORM_CONTROLS)[number]

export type ReportLoadState = {
  data: DailyReportData
  baseline: DailyReportData
  loadStatus: LoadStatus
  loadRequestId: number
}

export type StartLoadEffect =
  | { type: 'getByDate'; date: string; requestId: number }
  | { type: 'assignLocation'; href: string }

export type DateChangeResult =
  | { action: 'none'; state: ReportLoadState }
  | { action: 'startLoad'; date: string; state: ReportLoadState }

export function isReportDirty(
  _current: DailyReportData,
  _baseline: DailyReportData,
): boolean {
  throw new Error('STUB: isReportDirty')
}

export function emptyReport(date: string): DailyReportData {
  const base = defaultDailyReport()
  return { ...base, date: `__STUB_EMPTY__:${date}` }
}

export function isUnauthorizedError(_error: unknown): boolean {
  throw new Error('STUB: isUnauthorizedError')
}

export function shouldFetchReport(_date: string): boolean {
  throw new Error('STUB: shouldFetchReport')
}

export function applyLoadSuccess(
  date: string,
  report: DailyReportData | null,
): DailyReportData {
  if (report === null) {
    return emptyReport(date)
  }
  return { ...report, date: `__STUB_APPLY__:${date}` }
}

export function shouldPreventUnload(
  _dirty: boolean,
  _loadStatus: LoadStatus,
): boolean {
  throw new Error('STUB: shouldPreventUnload')
}

export function isLoadableReport(_value: unknown): boolean {
  throw new Error('STUB: isLoadableReport')
}

/** loading / error 時に操作不可とするコントロール集合（AC-L30 / AC-L42 / AC-L46） */
export function getDisabledControls(
  _loadStatus: LoadStatus,
): ReadonlySet<FormControl> {
  throw new Error('STUB: getDisabledControls')
}

/** error 時のみ操作可能なコントロール（AC-L46） */
export function getErrorEnabledControls(): ReadonlySet<FormControl> {
  throw new Error('STUB: getErrorEnabledControls')
}

/** SPA ヘッダー遷移で confirm を出すか（AC-L52 / AC-L56） */
export function shouldConfirmLeavePage(
  _dirty: boolean,
  _loadStatus: LoadStatus,
): boolean {
  throw new Error('STUB: shouldConfirmLeavePage')
}

/** 日付変更で confirm を出すか（AC-L50 / AC-L52） */
export function shouldConfirmDateChange(
  _dirty: boolean,
  _loadStatus: LoadStatus,
): boolean {
  throw new Error('STUB: shouldConfirmDateChange')
}

/** 入力タブ切替で confirm / beforeunload を出すか（AC-L53）— 常に false が正 */
export function shouldConfirmTabSwitch(): boolean {
  throw new Error('STUB: shouldConfirmTabSwitch')
}

export type StartLoadDeps = {
  getByDate: (date: string) => Promise<DailyReportData | null>
  assignLocation?: (href: string) => void
}

/**
 * 読み込み開始の同期フェーズ（loadRequestId 加算・loading 遷移・日付先行更新・API 呼び出し効果）
 * 設計書 startLoad step 1〜4
 */
export function beginStartLoad(
  state: ReportLoadState,
  date: string,
): { state: ReportLoadState; effects: StartLoadEffect[] } {
  return {
    state: { ...state, loadStatus: 'ready', loadRequestId: -1 },
    effects: [],
  }
}

/**
 * 読み込み応答の確定（stale 無視・401・失敗・成功）
 * 設計書 startLoad step 5〜8
 */
export async function finalizeStartLoad(
  state: ReportLoadState,
  date: string,
  requestId: number,
  deps: StartLoadDeps,
  _errorOrReport?: unknown,
): Promise<ReportLoadState> {
  void date
  void requestId
  void deps
  return state
}

/** 日付変更ハンドラの純粋分岐（設計書「日付変更」1〜4） */
export function handleDateChange(
  state: ReportLoadState,
  nextDate: string,
  deps: { confirm: (message: string) => boolean },
): DateChangeResult {
  void deps
  void nextDate
  return { action: 'none', state }
}

/** 読み込み開始〜完了の一連手順（副作用は deps 経由） */
export async function runStartLoad(
  state: ReportLoadState,
  date: string,
  deps: StartLoadDeps,
): Promise<ReportLoadState> {
  void date
  void deps
  return { ...state, loadStatus: 'ready' }
}
