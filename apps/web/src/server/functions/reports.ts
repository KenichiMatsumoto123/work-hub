/**
 * 日報データの DB 操作関数
 * createServerFn でラップし、クライアントから直接呼び出し可能
 *
 * エンドポイントは直接呼び出せるため、いずれも requireSession を通してログインを必須にする。
 *
 * 工数実績の正規化保存（設計書 `docs/設計/工数実績の正規化保存/工数実績の正規化保存_設計書.md`）：
 * `saveReportFn` は `daily_reports.raw_data` への書き込みと同一トランザクションで
 * 取引先・プロジェクト・タスクのマスタを解決し、実績工数を `time_entries` に記録する
 * （T-1）。`deleteReportFn` は同一トランザクションで `time_entries` も削除する（T-2）。
 */
import { createServerFn } from '@tanstack/react-start'
import { requireSession } from '../middleware/require-session'
import { db } from '../db'
import { clients, dailyReports, projects, tasks, timeEntries } from '../schema'
import { eq, and, gte, lt, sql } from 'drizzle-orm'
import type { DailyReportData } from '~/lib/types'
import { parseTime } from '~/lib/time-utils'
import {
  classifyActualHours,
  collectLengthViolations,
  isValidReportDate,
  isValidReportStructure,
  resolveTaskIdentity,
  toInputString,
  type LengthViolation,
  type TaskIdentity,
} from '../report-normalize'

/** DB行 → DailyReportData 変換 */
function rowToReport(row: typeof dailyReports.$inferSelect): DailyReportData {
  if (row.rawData && typeof row.rawData === 'object') {
    return row.rawData as DailyReportData
  }
  return {
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    breakTime: row.breakTime,
    note: row.note ?? '',
    projects: [],
    goodPoints: row.goodPoints ?? '',
    badPoints: row.badPoints ?? '',
    nextPlan: row.nextPlan ?? '',
  }
}

export const getAllReportsFn = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async () => {
    const rows = await db.select().from(dailyReports).orderBy(dailyReports.date)
    const result: Record<string, DailyReportData> = {}
    for (const row of rows) {
      result[row.date] = rowToReport(row)
    }
    return result
  })

export const getReportsByMonthFn = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .inputValidator((data: { year: number; month: number }) => data)
  .handler(async ({ data }) => {
    const { year, month } = data
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    const rows = await db
      .select()
      .from(dailyReports)
      .where(and(gte(dailyReports.date, startDate), lt(dailyReports.date, endDate)))
      .orderBy(dailyReports.date)

    return rows.map(rowToReport)
  })

// ---------------------------------------------------------------------------
// エラーメッセージの規範（設計書「エラーメッセージの規範」節に完全一致させる）
// ---------------------------------------------------------------------------

const 構造エラーメッセージ = '日報のデータ形式が不正です。'
const 上限見出し = '実績工数が上限（24時間）を超えています。'
const 長さ見出し = '名前が長すぎます（255文字以内にしてください）。'
const 削除対象なしメッセージ = '指定された日付の日報が存在しません。'

/** メッセージ内の入力値・最終値の切り詰め長（先頭 N 文字。UTF-16 コード単位） */
const MESSAGE_VALUE_TRUNCATE_LENGTH = 30

function truncateForMessage(value: string): string {
  return value.length > MESSAGE_VALUE_TRUNCATE_LENGTH
    ? value.slice(0, MESSAGE_VALUE_TRUNCATE_LENGTH)
    : value
}

// ---------------------------------------------------------------------------
// R-2〜R-6: 対象行の抽出・上限超過行・長さ超過の収集（トランザクション開始前）
// ---------------------------------------------------------------------------

type TargetRow = { identity: TaskIdentity; hours: number }
type OverRow = { title: string; displayValue: string }

/**
 * 日報の全プロジェクトブロックの全タスク行を走査し、R-2 の判定に従って
 * 「対象行」（time_entries を作る行）と「上限超過行」（保存全体をエラーにする行）に分類する。
 * スキップ行（判定 1・2）はどちらにも含めない（マスタも作らない。AC-27）。
 */
function collectRows(data: DailyReportData): { targetRows: TargetRow[]; overRows: OverRow[] } {
  const targetRows: TargetRow[] = []
  const overRows: OverRow[] = []

  for (const project of data.projects ?? []) {
    for (const task of project.tasks ?? []) {
      const classification = classifyActualHours(task.actualHours)
      if (classification.kind === 'skip') continue

      const identity = resolveTaskIdentity({
        clientName: project.name,
        projectName: task.label,
        taskName: task.name,
      })

      if (classification.kind === 'target') {
        targetRows.push({ identity, hours: classification.value })
      } else {
        overRows.push({
          title: identity.title,
          displayValue: truncateForMessage(toInputString(task.actualHours)),
        })
      }
    }
  }

  return { targetRows, overRows }
}

/**
 * E-3・E-4: 上限超過ブロック（該当時のみ）＋長さ超過ブロック（該当時のみ）を
 * 空行なしの改行 1 つで連結したメッセージを組み立てる。どちらも無ければ null。
 */
function buildValidationErrorMessage(
  overRows: OverRow[],
  lengthViolations: LengthViolation[],
): string | null {
  const blocks: string[] = []

  if (overRows.length > 0) {
    blocks.push(
      [上限見出し, ...overRows.map((row) => `「${row.title}」= ${row.displayValue}`)].join('\n'),
    )
  }

  if (lengthViolations.length > 0) {
    blocks.push(
      [
        長さ見出し,
        ...lengthViolations.map(
          (violation) =>
            `${violation.field}: 「${truncateForMessage(violation.value)}」（${violation.length}文字）`,
        ),
      ].join('\n'),
    )
  }

  return blocks.length > 0 ? blocks.join('\n') : null
}

// ---------------------------------------------------------------------------
// マスタ解決ロジック（M-1〜M-4）
// ---------------------------------------------------------------------------

/** `db.transaction()` のコールバックに渡されるトランザクションハンドルの型 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * M-1〜M-3 共通：「見つかればその ID を使う → 見つからなければ作成」。
 * 作成時の競合（同一キーの同時挿入）は S-1〜S-3 のユニーク制約が防ぐため、
 * 競合時は挿入を無視して再検索する（ON CONFLICT DO NOTHING → 再 SELECT）。
 * 再 SELECT が 0 件だった場合、挿入と再検索をちょうど 1 回だけやり直す。
 * それでも解決できなければエラーを投げてトランザクションを中断する（AC-64）。
 */
async function resolveWithRetry(
  select: () => Promise<{ id: string }[]>,
  insert: () => Promise<unknown>,
  label: string,
): Promise<string> {
  const initial = await select()
  if (initial[0]) return initial[0].id

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await insert()
    const reselected = await select()
    if (reselected[0]) return reselected[0].id
  }

  throw new Error(`マスタの解決に失敗しました: ${label}`)
}

/** M-1: 取引先（`clients`）。検索キー：`name = normalizeName(Project.name)` */
async function resolveClientId(tx: Tx, name: string): Promise<string> {
  const select = () =>
    tx.select({ id: clients.id }).from(clients).where(eq(clients.name, name)).limit(1)

  return resolveWithRetry(
    select,
    () => tx.insert(clients).values({ name }).onConflictDoNothing({ target: clients.name }),
    name,
  )
}

/**
 * M-2: プロジェクト（`projects`）。
 * 検索キー：`client_id = <解決済み取引先ID> AND name = normalizeName(Task.label)`
 */
async function resolveProjectId(tx: Tx, clientId: string, name: string): Promise<string> {
  const where = and(eq(projects.clientId, clientId), eq(projects.name, name))
  const select = () => tx.select({ id: projects.id }).from(projects).where(where).limit(1)

  return resolveWithRetry(
    select,
    () =>
      tx
        .insert(projects)
        .values({ clientId, name })
        .onConflictDoNothing({ target: [projects.clientId, projects.name] }),
    name,
  )
}

/**
 * M-3: タスク（`tasks`）。検索キー：`project_id`・`client_id`・`title` の 3 つ組。
 * NULL を含む比較には `IS NOT DISTINCT FROM` を用いる（`eq()` の `= NULL` は
 * 三値論理で常に UNKNOWN になり、adhoc タスクが決してヒットしないため）。
 */
async function resolveTaskId(
  tx: Tx,
  type: 'project' | 'adhoc',
  projectId: string | null,
  clientId: string | null,
  title: string,
): Promise<string> {
  const where = sql`${tasks.projectId} IS NOT DISTINCT FROM ${projectId}
    AND ${tasks.clientId} IS NOT DISTINCT FROM ${clientId}
    AND ${tasks.title} = ${title}`
  const select = () => tx.select({ id: tasks.id }).from(tasks).where(where).limit(1)

  return resolveWithRetry(
    select,
    () =>
      tx
        .insert(tasks)
        .values({ type, title, projectId, clientId })
        .onConflictDoNothing({ target: [tasks.projectId, tasks.clientId, tasks.title] }),
    title,
  )
}

function compareNullableString(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return -1
  if (b === null) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

type ResolvedTaskKey = {
  type: 'project' | 'adhoc'
  projectId: string | null
  clientId: string | null
  title: string
}

function taskKeyString(key: ResolvedTaskKey): string {
  return JSON.stringify([key.projectId, key.clientId, key.title])
}

/**
 * マスタ（取引先 → プロジェクト → タスク）を「解決の順序」に従ってまとめて解決し、
 * `time_entries` へ挿入する行を組み立てる（T-1 トランザクション内手順 4・5）。
 */
async function resolveMastersAndInsertEntries(
  tx: Tx,
  date: string,
  targetRows: TargetRow[],
): Promise<void> {
  // 1. 取引先：正規化後の名前の昇順に解決する
  const clientNames = Array.from(
    new Set(
      targetRows
        .map((row) => row.identity.clientName)
        .filter((name): name is string => name !== null),
    ),
  ).sort()

  const clientIdByName = new Map<string, string>()
  for (const name of clientNames) {
    clientIdByName.set(name, await resolveClientId(tx, name))
  }

  // 2. プロジェクト：(取引先ID, 正規化後の名前) の昇順に解決する
  //    （取引先が空の行の projectName は resolveTaskIdentity により常に null なので対象外）
  const projectKeys = new Map<string, { clientId: string; name: string }>()
  for (const row of targetRows) {
    const { identity } = row
    if (identity.type === 'project' && identity.clientName !== null && identity.projectName !== null) {
      const clientId = clientIdByName.get(identity.clientName)
      if (clientId === undefined) continue
      const key = `${clientId} ${identity.projectName}`
      if (!projectKeys.has(key)) {
        projectKeys.set(key, { clientId, name: identity.projectName })
      }
    }
  }
  const sortedProjectKeys = Array.from(projectKeys.entries()).sort(([, a], [, b]) => {
    const byClient = compareNullableString(a.clientId, b.clientId)
    return byClient !== 0 ? byClient : compareNullableString(a.name, b.name)
  })

  const projectIdByKey = new Map<string, string>()
  for (const [key, { clientId, name }] of sortedProjectKeys) {
    projectIdByKey.set(key, await resolveProjectId(tx, clientId, name))
  }

  /** 行から解決済みの (type, projectId, clientId, title) を得る（DB へは触れない） */
  function resolvedKeyOf(row: TargetRow): ResolvedTaskKey {
    const { identity } = row
    const clientId = identity.clientName !== null ? (clientIdByName.get(identity.clientName) ?? null) : null
    const projectId =
      identity.type === 'project' && identity.projectName !== null && clientId !== null
        ? (projectIdByKey.get(`${clientId} ${identity.projectName}`) ?? null)
        : null
    return { type: identity.type, projectId, clientId, title: identity.title }
  }

  // 3. タスク：(project_id, client_id, title) の昇順（NULL は最小）に解決する
  const taskKeys = new Map<string, ResolvedTaskKey>()
  for (const row of targetRows) {
    const key = resolvedKeyOf(row)
    const keyString = taskKeyString(key)
    if (!taskKeys.has(keyString)) taskKeys.set(keyString, key)
  }
  const sortedTaskKeys = Array.from(taskKeys.entries()).sort(([, a], [, b]) => {
    const byProject = compareNullableString(a.projectId, b.projectId)
    if (byProject !== 0) return byProject
    const byClient = compareNullableString(a.clientId, b.clientId)
    if (byClient !== 0) return byClient
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0
  })

  const taskIdByKey = new Map<string, string>()
  for (const [keyString, key] of sortedTaskKeys) {
    taskIdByKey.set(
      keyString,
      await resolveTaskId(tx, key.type, key.projectId, key.clientId, key.title),
    )
  }

  // 5. 対象行が 1 件以上ある場合、time_entries を 1 回の複数行 INSERT で挿入する
  //    （0 件のときは insert().values([]) が例外を投げるため発行しない）
  if (targetRows.length === 0) return

  const values = targetRows.map((row) => {
    const keyString = taskKeyString(resolvedKeyOf(row))
    const taskId = taskIdByKey.get(keyString)
    if (taskId === undefined) {
      throw new Error(`実績の記録に失敗しました（タスク未解決）: ${row.identity.title}`)
    }
    return { taskId, date, hours: String(row.hours) }
  })

  await tx.insert(timeEntries).values(values)
}

// ---------------------------------------------------------------------------
// 入力構造の検証（T-1・T-2 共通・トランザクション外・ハンドラ本体の先頭）
// ---------------------------------------------------------------------------

/**
 * T-2 の入力検証：`data` が null でないオブジェクト（配列でない）であり、
 * `date` が R-7 と同一の 3 条件を満たすこと。
 */
function isValidDeleteInput(value: unknown): value is { date: string } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  return isValidReportDate((value as { date?: unknown }).date)
}

/** 対象日のアドバイザリロックを獲得する（T-1 手順 1・T-2 手順 1 で共通のキー） */
function acquireDateLock(tx: Tx, date: string) {
  return tx.execute(sql`SELECT pg_advisory_xact_lock((${date}::date - DATE '2000-01-01')::bigint)`)
}

// ---------------------------------------------------------------------------
// saveReportFn / deleteReportFn
// ---------------------------------------------------------------------------

export const saveReportFn = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .inputValidator((data: DailyReportData) => data)
  .handler(async ({ data }) => {
    // R-7: 入力構造の検証（トランザクション開始前・DB に触れない）
    if (!isValidReportStructure(data)) {
      throw new Error(構造エラーメッセージ)
    }
    const report = data as DailyReportData

    // R-2・R-4〜R-6: 対象行・上限超過行の抽出と長さ検証（トランザクション開始前・DB に触れない）
    const { targetRows, overRows } = collectRows(report)
    const lengthViolations = collectLengthViolations(report)
    const validationMessage = buildValidationErrorMessage(overRows, lengthViolations)
    if (validationMessage !== null) {
      throw new Error(validationMessage)
    }

    const workHours =
      parseTime(report.endTime) - parseTime(report.startTime) - parseTime(report.breakTime)

    await db.transaction(async (tx) => {
      // 1. 対象日のアドバイザリロックを獲得する
      await acquireDateLock(tx, report.date)

      // 2. daily_reports の upsert（現行と同一。raw_data を含む）
      await tx
        .insert(dailyReports)
        .values({
          date: report.date,
          startTime: report.startTime,
          endTime: report.endTime,
          breakTime: report.breakTime,
          totalWorkHours: String(Math.max(0, workHours)),
          note: report.note || null,
          goodPoints: report.goodPoints || null,
          badPoints: report.badPoints || null,
          nextPlan: report.nextPlan || null,
          rawData: report as unknown as Record<string, unknown>,
        })
        .onConflictDoUpdate({
          target: dailyReports.date,
          set: {
            startTime: report.startTime,
            endTime: report.endTime,
            breakTime: report.breakTime,
            totalWorkHours: String(Math.max(0, workHours)),
            note: report.note || null,
            goodPoints: report.goodPoints || null,
            badPoints: report.badPoints || null,
            nextPlan: report.nextPlan || null,
            rawData: report as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          },
        })

      // 3. DELETE FROM time_entries WHERE date = 対象日
      await tx.delete(timeEntries).where(eq(timeEntries.date, report.date))

      // 4〜5. マスタの解決（解決の順序に従う）＋ time_entries の複数行 INSERT
      await resolveMastersAndInsertEntries(tx, report.date, targetRows)
    })

    return { success: true }
  })

export const deleteReportFn = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .inputValidator((data: { date: string }) => data)
  .handler(async ({ data }) => {
    // T-2 トランザクション外手順 2：入力検証（R-7 と同一の 3 条件）
    if (!isValidDeleteInput(data)) {
      throw new Error(構造エラーメッセージ)
    }
    const { date } = data

    await db.transaction(async (tx) => {
      // 1. 対象日のアドバイザリロックを獲得する（T-1 手順 1 と同一のキー）
      await acquireDateLock(tx, date)

      // 2. 対象日の daily_reports 行が存在することを確認する（AC-89）
      const existing = await tx
        .select({ id: dailyReports.id })
        .from(dailyReports)
        .where(eq(dailyReports.date, date))
        .limit(1)
      if (existing.length === 0) {
        throw new Error(削除対象なしメッセージ)
      }

      // 3. DELETE FROM time_entries WHERE date = 対象日
      await tx.delete(timeEntries).where(eq(timeEntries.date, date))

      // 4. DELETE FROM daily_reports WHERE date = 対象日
      await tx.delete(dailyReports).where(eq(dailyReports.date, date))
    })

    return { success: true }
  })
