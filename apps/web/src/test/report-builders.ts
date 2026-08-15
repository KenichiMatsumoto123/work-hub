/**
 * 日報データ（DailyReportData）のテスト用ビルダー
 *
 * 型の必須プロパティを満たした値を作るためのヘルパー。
 * `{ tasks: [] }` のような部分オブジェクトを直接書くと `npm run check-types` が
 * TS2739 で落ちるため、テストからは必ずこのビルダーを使う。
 */
import type { DailyReportData, Project, Task } from '~/lib/types'

let seq = 0

/** テスト内で一意な id を作る（実装は id を参照しないが型の必須プロパティのため） */
function nextId(): string {
  seq += 1
  return `test-id-${seq}`
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: nextId(),
    label: '',
    name: '',
    plannedHours: '',
    actualHours: '',
    progressBefore: '',
    progressExpected: '',
    progressActual: '',
    ...overrides,
  }
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: nextId(),
    name: '',
    plannedHours: '',
    tasks: [],
    ...overrides,
  }
}

/**
 * 1 プロジェクトブロック（取引先 1 件）とその配下のタスク行から日報を作る。
 * `rows` の `label` はプロジェクト名、`name` はタスク名に対応する（UI の placeholder に準拠）。
 */
export function makeSingleBlockReport(
  date: string,
  clientName: string,
  rows: Partial<Task>[],
): DailyReportData {
  return makeReport({
    date,
    projects: [makeProject({ name: clientName, tasks: rows.map((row) => makeTask(row)) })],
  })
}

export function makeReport(overrides: Partial<DailyReportData> = {}): DailyReportData {
  return {
    date: '2000-01-01',
    startTime: '9:00',
    endTime: '18:00',
    breakTime: '1:00',
    note: '',
    projects: [],
    goodPoints: '',
    badPoints: '',
    nextPlan: '',
    ...overrides,
  }
}

/** 指定した文字数の名前を作る（長さ検証用） */
export function nameOfLength(length: number, filler = 'あ'): string {
  return filler.repeat(length)
}

/**
 * 接頭辞つきで、ちょうど指定した文字数になる名前を作る。
 * 長い名前も後始末で回収できるようにするため（1.0 節 規定 1）。
 */
export function prefixedNameOfLength(prefix: string, length: number, filler = 'あ'): string {
  return prefix + filler.repeat(length - prefix.length)
}
