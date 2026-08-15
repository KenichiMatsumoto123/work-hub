/**
 * 工数実績の正規化保存：入力の変換・検証ルール（設計書 R-1〜R-7）
 *
 * 【Red Phase のスタブ】
 * Phase 5 時点では「シグネチャ ＋ 固定ダミー返却」のみを置いている。
 * 実ロジック（条件分岐・整形・フィルタ）は Phase 8（Green Phase）で実装する。
 *
 * ダミー値は「どのテストの期待値とも一致しない」ことだけを目的に選んでいる。
 * 真偽値を返す関数がスタブ段階で true / false のどちらかを返すと、
 * 期待値がその値のテストだけがトートロジー的に PASS してしまうため、
 * 真偽値の関数は「ダミー文字列を boolean にキャストして返す」形にしてある。
 * Phase 8 では本ファイルの実装をすべて置き換えること。
 */
import type { DailyReportData } from '~/lib/types'

/** Red Phase 用のダミー値（Phase 8 で削除する） */
const STUB = '__STUB__'

/** R-1: 名前の正規化。連続する空白列を半角スペース1つに畳み、前後の空白を除去する */
export function normalizeName(_value: string): string {
  return STUB
}

/**
 * R-7 の正規化：名前系フィールド・実績h が文字列でない場合の文字列化。
 * null / undefined は空文字、それ以外は String() 化する。
 */
export function toInputString(_value: unknown): string {
  return STUB
}

/** R-2 の判定結果。value は parseFloat の結果 */
export type HoursClassification =
  | { kind: 'skip' }
  | { kind: 'target'; value: number }
  | { kind: 'over'; value: number }

/** R-2: 実績h の判定（判定 1〜4 を規定の順序で適用する） */
export function classifyActualHours(_raw: unknown): HoursClassification {
  return { kind: 'target', value: -1 }
}

/** R-5: 正規化後のタスク名が空文字なら `(名称未設定)` を既定値として補う */
export function applyDefaultTaskName(_normalizedTaskName: string): string {
  return STUB
}

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
export function resolveTaskIdentity(_input: {
  clientName: unknown
  projectName: unknown
  taskName: unknown
}): TaskIdentity {
  return { type: 'project', clientName: STUB, projectName: STUB, title: STUB }
}

/** R-6 の長さ超過。value は DB へ書き込む最終値、length はその文字数 */
export type LengthViolation = {
  field: '取引先名' | 'プロジェクト名' | 'タスク名'
  value: string
  length: number
}

/**
 * R-6: 対象行（R-2 判定 4）について、DB へ書き込む最終値の長さを検証する。
 * 列挙単位は「（項目名, 最終値）の一意な組」であり、同一の組は 1 回だけ返す。
 */
export function collectLengthViolations(_data: DailyReportData): LengthViolation[] {
  return [{ field: 'タスク名', value: STUB, length: -1 }]
}

/**
 * R-7 条件 1〜3: `date` が `YYYY-MM-DD` 書式・実在する日・年 0001 以上であること。
 * 実在判定は日数表方式で行う（`Date` を使ってはならない）。
 */
export function isValidReportDate(_value: unknown): boolean {
  return STUB as unknown as boolean
}

/**
 * R-7 の構造検証：`data` が null でないオブジェクト（配列でない）であり、
 * `date` が上記 3 条件を満たし、`projects` / `projects[].tasks` が配列で
 * その要素がいずれも null でないオブジェクトであること。
 */
export function isValidReportStructure(_value: unknown): boolean {
  return STUB as unknown as boolean
}
