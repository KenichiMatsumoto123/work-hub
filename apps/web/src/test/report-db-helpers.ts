/**
 * 工数実績の正規化保存：DB込み結合テスト用のヘルパー
 *
 * テスト観点表 1.0 節「テストデータの分離（必須）」の規定を実装する。
 * - 規定 1：マスタ名は `IT<節2桁><観点2桁>-` を接頭辞に持つ
 * - 規定 2：件数の主張は接頭辞で絞った集合に対して行う（テーブル全体を数えない）
 * - 規定 3：後始末は `time_entries` → `daily_reports` → `tasks` → `projects` → `clients` の順。
 *           マスタは接頭辞一致だけでなく親子を辿って削除する
 * - 規定 4：接頭辞を付けられない固定名は「保存前に存在しなかった場合のみ削除する」
 *
 * `truncateTables()` は使わない（開発用 DB のデータを消さないため）。
 */
import postgres from 'postgres'
import { and, eq, inArray, like, or, sql } from 'drizzle-orm'
import { db } from '../server/db'
import { resolveDatabaseUrl } from '../server/env'
import { clients, dailyReports, projects, tasks, timeEntries } from '../server/schema'
import { deleteReportFn, saveReportFn } from '../server/functions/reports'
import type { DailyReportData } from '~/lib/types'

/** テストからも本体と同じ接続を使う */
export const testDb = db

/**
 * 並行性テスト用の専用クライアント（土台の規定 1）。
 * `testDb` は本体と同じプールを共有するため、ロックを保持する用途には使えない。
 * 使い終わったら必ず `end()` すること（規定 7）。
 */
export function makeDedicatedClient() {
  return postgres(resolveDatabaseUrl(), { max: 1 })
}

export type DedicatedClient = ReturnType<typeof makeDedicatedClient>

/** アドバイザリロックのキー：`(<対象日>::date - DATE '2000-01-01')::bigint` */
export async function advisoryKeyOf(client: DedicatedClient, date: string): Promise<string> {
  const rows = await client<{ key: string }[]>`
    SELECT ((${date}::date - DATE '2000-01-01')::bigint)::text AS key
  `
  return rows[0].key
}

/**
 * 当該キーの advisory ロック行数を数える。
 * シフトと論理積は SQL 側で評価する（JS の `>>` は 32 ビット演算のため誤る）。
 */
export async function advisoryLockCount(
  client: DedicatedClient,
  key: string,
  onlyGranted = false,
): Promise<number> {
  const rows = await client<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM pg_locks
    WHERE locktype = 'advisory'
      AND classid::bigint = (${key}::bigint >> 32)
      AND objid::bigint = (${key}::bigint & 4294967295)
      AND objsubid = 1
      AND (granted OR NOT ${onlyGranted}::boolean)
  `
  return rows[0].n
}

/** 指定した日付の `time_entries` → `daily_reports` を削除する（規定 3 の前半） */
export async function deleteByDates(dates: string[]): Promise<void> {
  if (dates.length === 0) return
  await testDb.delete(timeEntries).where(inArray(timeEntries.date, dates))
  await testDb.delete(dailyReports).where(inArray(dailyReports.date, dates))
}

/**
 * 接頭辞のマスタを `tasks` → `projects` → `clients` の順に削除する（規定 3 の後半）。
 * 接頭辞一致だけでなく親子を辿る（接頭辞付きの親にぶら下がった非接頭辞の子を残さない）。
 */
export async function deleteMastersByPrefix(prefix: string): Promise<void> {
  const pattern = `${prefix}%`

  const clientRows = await testDb
    .select({ id: clients.id })
    .from(clients)
    .where(like(clients.name, pattern))
  const clientIds = clientRows.map((row) => row.id)

  const projectRows = await testDb
    .select({ id: projects.id })
    .from(projects)
    .where(
      clientIds.length > 0
        ? or(like(projects.name, pattern), inArray(projects.clientId, clientIds))
        : like(projects.name, pattern),
    )
  const projectIds = projectRows.map((row) => row.id)

  const taskConditions = [like(tasks.title, pattern)]
  if (projectIds.length > 0) taskConditions.push(inArray(tasks.projectId, projectIds))
  if (clientIds.length > 0) taskConditions.push(inArray(tasks.clientId, clientIds))
  await testDb.delete(tasks).where(or(...taskConditions))

  if (projectIds.length > 0) await testDb.delete(projects).where(inArray(projects.id, projectIds))
  if (clientIds.length > 0) await testDb.delete(clients).where(inArray(clients.id, clientIds))
}

/** 規定 3 の後始末をまとめて行う */
export async function cleanup(prefix: string, dates: string[]): Promise<void> {
  await deleteByDates(dates)
  await deleteMastersByPrefix(prefix)
}

/** 規定 4：接頭辞を付けられない固定名の、保存前の状態 */
export type FixedNameSnapshot = {
  names: string[]
  clientIds: string[]
  projectIds: string[]
  taskIds: string[]
}

/** 規定 4：固定名の行が保存前に存在したかを記録する */
export async function snapshotFixedNames(names: string[]): Promise<FixedNameSnapshot> {
  const clientRows = await testDb
    .select({ id: clients.id })
    .from(clients)
    .where(inArray(clients.name, names))
  const projectRows = await testDb
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.name, names))
  const taskRows = await testDb
    .select({ id: tasks.id })
    .from(tasks)
    .where(inArray(tasks.title, names))

  return {
    names,
    clientIds: clientRows.map((row) => row.id),
    projectIds: projectRows.map((row) => row.id),
    taskIds: taskRows.map((row) => row.id),
  }
}

/**
 * 規定 4：保存前に存在しなかった固定名の行だけを削除する。
 * `time_entries` は巻き添えで削除しない（開発者の実データを壊さないため）。
 * 参照が残っていて削除できない場合は残置し、警告だけ出す。
 */
export async function cleanupFixedNames(snapshot: FixedNameSnapshot): Promise<void> {
  const { names } = snapshot
  if (names.length === 0) return

  const taskRows = await testDb
    .select({ id: tasks.id })
    .from(tasks)
    .where(inArray(tasks.title, names))
  await deleteNewRows(
    'tasks',
    taskRows.map((row) => row.id),
    snapshot.taskIds,
    (ids) => testDb.delete(tasks).where(inArray(tasks.id, ids)),
  )

  const projectRows = await testDb
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.name, names))
  await deleteNewRows(
    'projects',
    projectRows.map((row) => row.id),
    snapshot.projectIds,
    (ids) => testDb.delete(projects).where(inArray(projects.id, ids)),
  )

  const clientRows = await testDb
    .select({ id: clients.id })
    .from(clients)
    .where(inArray(clients.name, names))
  await deleteNewRows(
    'clients',
    clientRows.map((row) => row.id),
    snapshot.clientIds,
    (ids) => testDb.delete(clients).where(inArray(clients.id, ids)),
  )
}

async function deleteNewRows(
  label: string,
  currentIds: string[],
  knownIds: string[],
  run: (ids: string[]) => Promise<unknown>,
): Promise<void> {
  const targets = currentIds.filter((id) => !knownIds.includes(id))
  if (targets.length === 0) return
  try {
    await run(targets)
  } catch (error) {
    console.warn(`[report-db-helpers] ${label} の固定名行を削除できませんでした`, error)
  }
}

// ---------------------------------------------------------------------------
// 観測用のクエリ
// ---------------------------------------------------------------------------

/** 指定日の `time_entries`（hours は DB から読んだ文字列のまま返す） */
export async function entriesOfDate(date: string) {
  return testDb
    .select({ id: timeEntries.id, taskId: timeEntries.taskId, hours: timeEntries.hours })
    .from(timeEntries)
    .where(eq(timeEntries.date, date))
}

/** 指定日の `time_entries` を `tasks` と結合して返す */
export async function entriesWithTaskOfDate(date: string) {
  return testDb
    .select({
      hours: timeEntries.hours,
      taskId: timeEntries.taskId,
      title: tasks.title,
      type: tasks.type,
      clientId: tasks.clientId,
      projectId: tasks.projectId,
    })
    .from(timeEntries)
    .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .where(eq(timeEntries.date, date))
}

/** 指定日の `time_entries` の件数と合計（合計は数値に直して返す） */
export async function entrySummaryOfDate(date: string): Promise<{ count: number; total: number }> {
  const rows = await entriesOfDate(date)
  return {
    count: rows.length,
    total: Number(rows.reduce((sum, row) => sum + Number(row.hours), 0).toFixed(2)),
  }
}

export async function dailyReportOfDate(date: string) {
  const rows = await testDb.select().from(dailyReports).where(eq(dailyReports.date, date))
  return rows[0] ?? null
}

export async function clientNamesByPrefix(prefix: string): Promise<string[]> {
  const rows = await testDb
    .select({ name: clients.name })
    .from(clients)
    .where(like(clients.name, `${prefix}%`))
  return rows.map((row) => row.name).sort()
}

export async function projectNamesByPrefix(prefix: string): Promise<string[]> {
  const rows = await testDb
    .select({ name: projects.name })
    .from(projects)
    .where(like(projects.name, `${prefix}%`))
  return rows.map((row) => row.name).sort()
}

export async function taskTitlesByPrefix(prefix: string): Promise<string[]> {
  const rows = await testDb
    .select({ title: tasks.title })
    .from(tasks)
    .where(like(tasks.title, `${prefix}%`))
  return rows.map((row) => row.title).sort()
}

export async function clientsByPrefix(prefix: string) {
  return testDb.select().from(clients).where(like(clients.name, `${prefix}%`))
}

export async function projectsByPrefix(prefix: string) {
  return testDb.select().from(projects).where(like(projects.name, `${prefix}%`))
}

export async function tasksByPrefix(prefix: string) {
  return testDb.select().from(tasks).where(like(tasks.title, `${prefix}%`))
}

/** 接頭辞のタスクに紐づく `time_entries` の件数（日付スコープではなく接頭辞スコープ） */
export async function entryCountForTasksByPrefix(prefix: string): Promise<number> {
  const rows = await testDb
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .where(like(tasks.title, `${prefix}%`))
  return rows.length
}

/** 日付が `::date` にキャストできることの機械的な検査（1.0 節 規定 5） */
export async function assertDatesAreReal(dates: string[]): Promise<void> {
  for (const date of dates) {
    await testDb.execute(sql`SELECT ${date}::date`)
  }
}

/** 決着の内容（正常終了なら ok、throw したら err） */
export type Settled = { ok?: unknown; err?: unknown }

export type Tracked = {
  /** 決着済みか（同期に読める。X ms 待ったあとに参照する） */
  isSettled: () => boolean
  /** 決着の内容 */
  done: Promise<Settled>
}

/**
 * 起動直後に `.catch()` を装着する（土台の規定 3）。
 * 後付けにすると unhandledRejection で run 全体が exit code 1 になる。
 */
export function track(promise: Promise<unknown>): Tracked {
  let settled = false
  const done = promise.then(
    (value) => {
      settled = true
      return { ok: value ?? null } as Settled
    },
    (error) => {
      settled = true
      return { err: error } as Settled
    },
  )
  return { isSettled: () => settled, done }
}

/** SQLSTATE を取り出す（Drizzle 経由は `e.cause.code`・postgres-js 直は `e.code`。規定 9） */
export function sqlStateOf(error: unknown): string | undefined {
  const candidate = error as { code?: string; cause?: { code?: string } }
  return candidate?.cause?.code ?? candidate?.code
}

/**
 * サーバー関数の直接呼び出し。
 * Vitest からの直接呼び出しでは戻り値が `undefined` になるため、
 * 「保存に成功する」は「throw しないこと」と読み替える（1.0 節 規定 6）。
 */
export function saveReport(data: unknown): Promise<unknown> {
  return saveReportFn({ data: data as DailyReportData })
}

export function deleteReport(date: unknown): Promise<unknown> {
  return deleteReportFn({ data: { date } as { date: string } })
}

/**
 * `data` をラップせずそのまま渡す（`deleteReport` は常に `{ date }` に包むため、
 * `data` 自体が `null`/`undefined` の経路を検証できない。FIND-B01）
 */
export function deleteReportRaw(data: unknown): Promise<unknown> {
  return deleteReportFn({ data: data as { date: string } })
}

/** throw された Error の message（throw しなかった場合も判別できる文字列を返す） */
export async function errorMessageOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return '（throw しなかった）'
  } catch (error) {
    return (error as Error).message
  }
}

/** ミリ秒待つ（待ち時間 X の経過用） */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** `and` の再エクスポート（テスト側で条件を組むため） */
export { and, eq, inArray, like, or, sql }
