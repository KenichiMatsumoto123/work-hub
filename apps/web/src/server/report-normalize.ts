/**
 * 工数実績の正規化保存：入力の変換・検証ルール（設計書 R-1〜R-7）
 *
 * 根拠：`docs/設計/工数実績の正規化保存/工数実績の正規化保存_設計書.md`
 * 「変換ルール仕様」節。関数名・シグネチャは Phase 5 のスタブを維持する
 * （テストが import しているため変更できない）。
 */
import type { DailyReportData } from '~/lib/types'

// ---------------------------------------------------------------------------
// R-1: 名前の正規化
// ---------------------------------------------------------------------------

/**
 * R-1: 名前の正規化。JS の `\s` が空白とみなす集合（半角スペース・タブ・改行・
 * 全角スペース・NBSP 等）のうち 1 文字以上の連続を半角スペース 1 つに置換し、
 * 前後の空白を除去する。小文字化・全角半角変換・Unicode 正規化は行わない。
 */
export function normalizeName(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

// ---------------------------------------------------------------------------
// R-7 の正規化：名前系フィールド・実績h の文字列化
// ---------------------------------------------------------------------------

/**
 * R-7 の正規化：名前系フィールド・実績h が文字列でない場合の文字列化。
 * null / undefined は空文字、それ以外は String() 化する。
 */
export function toInputString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

// ---------------------------------------------------------------------------
// R-2: 実績h の判定
// ---------------------------------------------------------------------------

/** R-2 の判定結果。value は parseFloat の結果 */
export type HoursClassification =
  | { kind: 'skip' }
  | { kind: 'target'; value: number }
  | { kind: 'over'; value: number }

/**
 * R-2: 実績h の判定（判定 1〜4 を規定の順序で適用する）。
 * 判定 4 は能動条件（`0` 以上 かつ `24.005` 未満）で定義する。
 * 根拠：差分設計「実績0hの保存」が親 R-2 を上書き。
 */
export function classifyActualHours(raw: unknown): HoursClassification {
  const value = parseFloat(toInputString(raw))

  // 判定 1: NaN はスキップ
  if (Number.isNaN(value)) return { kind: 'skip' }
  // 判定 2: 0 未満はスキップ（負数・-Infinity を含む。-0 は JS では 0 未満ではない）
  if (value < 0) return { kind: 'skip' }
  // 判定 3: 24.005 以上は保存全体をエラーにする対象
  if (value >= 24.005) return { kind: 'over', value }
  // 判定 4: 0 以上 24.005 未満が対象行（parseFloat の結果をそのまま返す）
  return { kind: 'target', value }
}

// ---------------------------------------------------------------------------
// R-5: タスク名の既定値
// ---------------------------------------------------------------------------

/** R-5: 正規化後のタスク名が空文字なら `(名称未設定)` を既定値として補う */
export function applyDefaultTaskName(normalizedTaskName: string): string {
  return normalizedTaskName === '' ? '(名称未設定)' : normalizedTaskName
}

// ---------------------------------------------------------------------------
// R-4: tasks の識別情報の決定
// ---------------------------------------------------------------------------

/**
 * R-4 で決まる tasks の識別情報。
 * clientName / projectName は「マスタを解決する名前」（解決しない場合は null）。
 */
export type TaskIdentity = {
  type: 'project' | 'adhoc'
  clientName: string | null
  projectName: string | null
  title: string
}

/** R-4（＋R-1・R-5）: 1 行分の tasks 識別情報を決定する */
export function resolveTaskIdentity(input: {
  clientName: unknown
  projectName: unknown
  taskName: unknown
}): TaskIdentity {
  const client = normalizeName(toInputString(input.clientName))
  const project = normalizeName(toInputString(input.projectName))
  const task = applyDefaultTaskName(normalizeName(toInputString(input.taskName)))

  if (client !== '' && project !== '') {
    return { type: 'project', clientName: client, projectName: project, title: task }
  }
  if (client !== '' && project === '') {
    return { type: 'adhoc', clientName: client, projectName: null, title: task }
  }
  if (client === '' && project !== '') {
    // 取引先が空の場合、projects は作らずタスク名へ連結する（R-4）
    return { type: 'adhoc', clientName: null, projectName: null, title: `${project} / ${task}` }
  }
  return { type: 'adhoc', clientName: null, projectName: null, title: task }
}

// ---------------------------------------------------------------------------
// R-6: 名前の長さ検証
// ---------------------------------------------------------------------------

/** R-6 の長さ超過。value は DB へ書き込む最終値、length はその文字数 */
export type LengthViolation = {
  field: '取引先名' | 'プロジェクト名' | 'タスク名'
  value: string
  length: number
}

/**
 * R-6: 対象行（R-2 判定 4）について、DB へ書き込む最終値の長さを検証する。
 * 列挙単位は「（項目名, 最終値）の一意な組」であり、同一の組は 1 回だけ返す。
 * 順序は、初めて検出された対象行の位置（プロジェクトブロック順・タスク行順）を
 * 基準とし、同一行内では 取引先名 → プロジェクト名 → タスク名 の順とする。
 */
export function collectLengthViolations(data: DailyReportData): LengthViolation[] {
  const seen = new Set<string>()
  const violations: LengthViolation[] = []

  const addIfLong = (field: LengthViolation['field'], value: string) => {
    if (value.length <= 255) return
    const key = JSON.stringify([field, value])
    if (seen.has(key)) return
    seen.add(key)
    violations.push({ field, value, length: value.length })
  }

  for (const project of data.projects ?? []) {
    for (const task of project.tasks ?? []) {
      const classification = classifyActualHours(task.actualHours)
      if (classification.kind !== 'target') continue

      const identity = resolveTaskIdentity({
        clientName: project.name,
        projectName: task.label,
        taskName: task.name,
      })

      if (identity.clientName !== null) addIfLong('取引先名', identity.clientName)
      if (identity.projectName !== null) addIfLong('プロジェクト名', identity.projectName)
      addIfLong('タスク名', identity.title)
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// R-7: 入力構造の検証と正規化
// ---------------------------------------------------------------------------

/** 月ごとの日数（2 月は isLeap で分岐する） */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** 先発グレゴリオ暦の閏年判定（PostgreSQL の date 型と同じ暦） */
function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/** 月ごとの日数（2 月は isLeap(y) で 28/29 を分岐する） */
function daysInMonth(y: number, mo: number): number {
  if (mo === 2) return isLeap(y) ? 29 : 28
  return DAYS_IN_MONTH[mo - 1]
}

/**
 * R-7 条件 1〜3: `date` が `YYYY-MM-DD` 書式・実在する日・年 0001 以上であること。
 * 実在判定は日数表方式で行う（`Date` を使ってはならない）。
 */
export function isValidReportDate(value: unknown): boolean {
  if (typeof value !== 'string') return false

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const y = Number(match[1])
  const mo = Number(match[2])
  const d = Number(match[3])

  if (y < 1) return false
  if (mo < 1 || mo > 12) return false
  if (d < 1 || d > daysInMonth(y, mo)) return false

  return true
}

/**
 * R-7 の構造検証：`data` が null でないオブジェクト（配列でない）であり、
 * `date` が上記 3 条件を満たし、`projects` / `projects[].tasks` が配列で
 * その要素がいずれも null でないオブジェクトであること。
 */
export function isValidReportStructure(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false

  const data = value as { date?: unknown; projects?: unknown }

  if (!isValidReportDate(data.date)) return false
  if (!Array.isArray(data.projects)) return false

  for (const project of data.projects as unknown[]) {
    if (project === null || typeof project !== 'object') return false

    const tasks = (project as { tasks?: unknown }).tasks
    if (!Array.isArray(tasks)) return false

    for (const task of tasks as unknown[]) {
      if (task === null || typeof task !== 'object') return false
    }
  }

  return true
}
