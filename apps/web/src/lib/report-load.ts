/**
 * 日報読み込みの純粋関数（設計書「純粋関数の配置」）
 * Phase 5 Red Phase：シグネチャ＋スタブ最小実装（実ロジック禁止）
 */
import type { DailyReportData } from './types'

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

export function isReportDirty(
  _current: DailyReportData,
  _baseline: DailyReportData,
): boolean {
  throw new Error('STUB: isReportDirty')
}

export function emptyReport(_date: string): DailyReportData {
  throw new Error('STUB: emptyReport')
}

export function isUnauthorizedError(_error: unknown): boolean {
  throw new Error('STUB: isUnauthorizedError')
}

export function shouldFetchReport(_date: string): boolean {
  throw new Error('STUB: shouldFetchReport')
}

export function applyLoadSuccess(
  _date: string,
  _report: DailyReportData | null,
): DailyReportData {
  throw new Error('STUB: applyLoadSuccess')
}

export function shouldPreventUnload(
  _dirty: boolean,
  _loadStatus: LoadStatus,
): boolean {
  throw new Error('STUB: shouldPreventUnload')
}

/** AC-L51 / L56：SPA 内ヘッダー遷移 confirm（shouldPreventUnload とは別契約） */
export function shouldConfirmSpaLeave(
  _dirty: boolean,
  _loadStatus: LoadStatus,
): boolean {
  throw new Error('STUB: shouldConfirmSpaLeave')
}

/** AC-L55：保存成功後に baseline を data に揃える */
export function markReportSaved(_state: ReportLoadState): ReportLoadState {
  throw new Error('STUB: markReportSaved')
}

export function isLoadableReport(_value: unknown): boolean {
  throw new Error('STUB: isLoadableReport')
}

/** loading / error / ready 時の操作可否（AC-L30 / L42 / L46） */
export function getFormControlsAccessibility(
  _loadStatus: LoadStatus,
): FormControlsAccessibility {
  throw new Error('STUB: getFormControlsAccessibility')
}

/**
 * 読み込み開始〜応答確定（設計書 startLoad 8 ステップ）
 */
export async function startLoad(
  state: ReportLoadState,
  date: string,
  deps: StartLoadDeps,
): Promise<ReportLoadState> {
  void state
  void date
  void deps
  throw new Error('STUB: startLoad')
}

/** 日付変更の分岐（設計書「日付変更」1〜4） */
export function onDateChange(
  state: ReportLoadState,
  nextDate: string,
  deps: { confirm: (message: string) => boolean },
): DateChangeResult {
  void deps
  void nextDate
  return { action: 'none', state }
}
