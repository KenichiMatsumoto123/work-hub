/**
 * 工数実績の正規化保存：DB込み結合テスト用のヘルパー
 *
 * テスト観点表 1.0 節「テストデータの分離（必須）」の規定を実装する。
 * - 規定 1：マスタ名は `IT<節2桁><観点2桁>-` を接頭辞に持つ
 * - 規定 2：件数の主張は接頭辞で絞った集合に対して行う（テーブル全体を数えない）
 * - 規定 3：後始末は `time_entries` → `daily_reports` → `tasks` → `projects` → `clients` の順。
 *           マスタは接頭辞一致だけでなく親子を辿って削除する。`time_entries` / `daily_reports`
 *           の日付ベース削除は「保存前に存在しなかった行のみ削除する」（下記「FIND-C01 の防御」参照）
 * - 規定 4：接頭辞を付けられない固定名は「保存前に存在しなかった場合のみ削除する」
 *
 * `truncateTables()` は使わない（開発用 DB のデータを消さないため）。
 */
import postgres from 'postgres'
import { beforeAll } from 'vitest'
import { and, eq, inArray, like, or, sql } from 'drizzle-orm'
import { db } from '../server/db'
import { resolveDatabaseUrl } from '../server/env'
import { clients, dailyReports, projects, tasks, timeEntries } from '../server/schema'
import { deleteReportFn, saveReportFn } from '../server/functions/reports'
import type { DailyReportData } from '~/lib/types'
import { assertNotDevDatabase } from './assert-not-dev-database'
import { selectDeleteTargetIds } from './report-db-delete-targets'

// ---------------------------------------------------------------------------
// 観点表 1.0 節 規定 10（Phase 6 Round 3 FIND-R3-C01・Critical）のガードB：
// 開発 DB への接続を機構で拒否する。
//
// `saveReportFn` は `daily_reports.date`（unique）に対する真の UPSERT であり、
// 衝突時は既存行を同じ id のまま中身だけ上書きする。開発用 DB に接続したまま
// 結合テストを実行すると、削除ではなく「サイレントな内容破壊」が起きる。
// 開発用 DB 名の出典：`../server/env.ts` の `DEV_FALLBACK_DATABASE_URL` および
// `docker-compose.yml` の `POSTGRES_DB`（いずれも `workhub`）。
// CI（`.github/workflows/ci.yml`）は `workhub_test` を使うため影響しない。
//
// 実装は DB クライアントに依存しない独立モジュール `assert-not-dev-database.ts` に
// 切り出してある。`vitest.integration.config.ts` の `setupFiles` からも同じ関数が
// 呼ばれ、このファイルを import しない結合テストにも機構で強制する
// （Phase 6 Round 3 FIND-LC-M01・Major）。
//
// モジュール評価時（import 直後）に同期的に検査する。`db`（server/db.ts）は
// 遅延接続の Proxy であり、この検査自体は接続を発生させない。
// ---------------------------------------------------------------------------

assertNotDevDatabase()

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

// ---------------------------------------------------------------------------
// FIND-C01（Critical）の防御：日付ベース削除が利用者の実データを破壊しないようにする
//
// 改訂前は `deleteByDates` が `WHERE date IN (...)` で無条件 DELETE していたため、
// 利用者の開発 DB に同じ日付の日報・実績があるとそれを破壊した（規定 4 が固定名について
// 警告していたのと同型の事故）。観点表 1.0 節 規定 3（2026-08-15 改訂）に従い、
// 「テストが書き込む前に存在しなかった行だけを削除する」防御をヘルパー内部で完結させる。
//
// スナップショットのタイミング：
// Vitest はテストファイルごとにモジュールを再読込する（`fileParallelism: false` かつ既定の
// `isolate: true`）ため、このモジュールの直下で呼ぶ `beforeAll` は「このヘルパーを import した
// テストファイルにつき 1 回」実行される。import 時点でこのモジュールのトップレベルコードが
// テストファイル自身のトップレベルコードより先に評価されるため、この `beforeAll` は
// テストファイル自身が登録する `beforeAll`（reports-transaction.integration.test.ts の
// T 計測用書き込みを含む）より先に実行される。したがって「そのファイルの最初の書き込みより前」の
// time_entries / daily_reports の全行 id を確実に記録できる。
//
// 安全側の方針（無条件削除への退行を避ける）：
// - スナップショットが未取得の状態で `deleteByDates` が呼ばれた場合は、削除を一切行わない
//   （「対象日の全行を保存前から存在した行とみなす」という安全側の解釈であり、無条件削除には戻さない）
// - プロセスが `beforeAll` 実行後・後始末前に強制終了した場合、次回の実行では新たなスナップショットが
//   その時点の DB 状態（クラッシュ由来の残留行を含む）を基準にする。残留行は「保存前から存在した行」
//   として扱われ、以後の実行でも削除されない（規定 4 の `cleanupFixedNames` と同じトレードオフ。
//   実データを壊すより、まれに残留行が残るほうを選ぶ）
// ---------------------------------------------------------------------------

type PreWriteSnapshot = {
  timeEntryIds: Set<string>
  dailyReportIds: Set<string>
}

let preWriteSnapshot: PreWriteSnapshot | null = null

async function capturePreWriteSnapshot(): Promise<void> {
  const [teRows, drRows] = await Promise.all([
    testDb.select({ id: timeEntries.id }).from(timeEntries),
    testDb.select({ id: dailyReports.id }).from(dailyReports),
  ])
  preWriteSnapshot = {
    timeEntryIds: new Set(teRows.map((row) => row.id)),
    dailyReportIds: new Set(drRows.map((row) => row.id)),
  }
}

// ---------------------------------------------------------------------------
// 観点表 1.0 節 規定 10（Phase 6 Round 3 FIND-R3-C01・Critical）のガードA：
// 書き込み前の非空チェック。
//
// 規定 3 のスナップショット（上記）は DELETE 経路しか守らない。`saveReportFn` は
// `daily_reports.date`（unique）に対する真の UPSERT であり、衝突時は既存行を
// 同じ id のまま中身だけ上書きする。id が保持されるため `deleteByDates` は
// 「削除しない」と正しく判定するが、それは中身が破壊されていないことを意味しない。
//
// そこで、本表（1.0 節 規定 5 の日付割当表・5-10 の寛容パース対応表・
// 2 章 E2E-1〜E2E-7）が割り当てた全日付について、スナップショット取得の直後に
// `daily_reports` / `time_entries` が 0 件であることを確認する。1 件でもあれば
// 黙って進めず throw してテスト実行全体を中断する（対応表との突き合わせは
// テスト作成報告に記載）。
// ---------------------------------------------------------------------------

/**
 * 結合テストが書き込みに使う全日付（観点表 1.0 節 規定 5 の日付割当表・
 * 5-10 の寛容パース対応表・2 章 E2E-1〜E2E-7 の合算・重複排除・昇順）。
 */
export const GUARD_DATES: readonly string[] = [
  // 5-10 寛容パース対応表 + E2E-1（'2000-1-1' → 2000-01-01 と E2E-1 のセンチネルが重複）
  '2000-01-01',
  // E2E-2〜E2E-7
  '2000-01-02',
  '2000-01-03',
  '2000-01-04',
  '2000-01-05',
  '2000-01-06',
  '2000-01-07',
  // 1.1 不可逆操作（1-1〜1-12）
  '2000-01-10',
  '2000-01-11',
  '2000-01-12',
  '2000-01-13',
  '2000-01-14',
  '2000-01-15',
  '2000-01-16',
  '2000-01-17',
  '2000-01-18',
  '2000-01-19',
  '2000-01-20',
  '2000-01-21',
  '2000-01-22',
  '2000-01-23',
  '2000-01-24',
  // 1.2 DB制約依存（2-5〜2-8）
  '2000-01-25',
  '2000-01-26',
  '2000-01-27',
  '2000-01-28',
  '2000-02-01',
  '2000-02-02',
  '2000-02-03',
  '2000-02-04',
  '2000-02-05',
  '2000-02-06',
  '2000-02-07',
  // 1.3 実JOIN（3-1〜3-8）
  '2000-02-08',
  '2000-02-09',
  '2000-02-10',
  '2000-02-11',
  '2000-02-12',
  '2000-02-13',
  '2000-02-14',
  '2000-02-15',
  '2000-02-16',
  '2000-02-17',
  '2000-02-18',
  // 1.4 トランザクション（4-2〜4-5・4-9）
  '2000-02-19',
  '2000-02-20',
  '2000-02-21',
  '2000-02-22',
  '2000-02-23',
  '2000-02-25',
  '2000-02-26',
  // 1.5 共通（5-1・5-2・5-4〜5-9・5-11・5-12）
  '2000-02-24',
  '2000-02-27',
  '2000-02-28',
  '2000-02-29', // 5-10 ACCEPTED（通過ケース。実在の閏日）
  '2000-03-01',
  '2000-03-02',
  '2000-03-03',
  '2000-03-04',
  '2000-03-05',
  '2000-03-06',
  '2000-03-07',
  '2000-03-08',
  // T計測用の捨て日付（1.0 節 規定 7）
  '2000-03-10',
  // 5-7③②の追加保存分
  '2000-03-11',
  '2000-03-12',
  // 5-10 ACCEPTED（通過ケース）
  '0004-02-29',
  '0050-03-01', // ACCEPTED であり、かつ ROLLOVER_SEED_DATES とも重複
  // 5-10 ROLLOVER_SEED_DATES（寛容パース対応表の残り）
  '1900-03-01',
  '2026-03-01',
  '2026-03-02',
  '2028-02-29',
]

async function assertGuardDatesAreEmpty(): Promise<void> {
  const [teRows, drRows] = await Promise.all([
    testDb
      .select({ date: timeEntries.date })
      .from(timeEntries)
      .where(inArray(timeEntries.date, [...GUARD_DATES])),
    testDb
      .select({ date: dailyReports.date })
      .from(dailyReports)
      .where(inArray(dailyReports.date, [...GUARD_DATES])),
  ])
  if (teRows.length === 0 && drRows.length === 0) return

  const countBy = (rows: { date: string }[]): Map<string, number> => {
    const counts = new Map<string, number>()
    for (const row of rows) counts.set(row.date, (counts.get(row.date) ?? 0) + 1)
    return counts
  }
  const teCounts = countBy(teRows)
  const drCounts = countBy(drRows)
  const dates = Array.from(new Set([...teCounts.keys(), ...drCounts.keys()])).sort()

  const lines = dates.map((date) => {
    const parts: string[] = []
    if (drCounts.has(date)) parts.push(`daily_reports ${drCounts.get(date)}件`)
    if (teCounts.has(date)) parts.push(`time_entries ${teCounts.get(date)}件`)
    return `  - ${date}: ${parts.join(' / ')}`
  })

  throw new Error(
    '[report-db-helpers] 結合テスト（DB込み）が書き込みに使う対象日付に、既存データが見つかったため' +
      'テスト実行全体を中断しました。\n' +
      'このまま実行すると、saveReportFn の UPSERT（daily_reports.date のユニーク制約）により、' +
      '既存行が id を保持したまま中身だけサイレントに上書きされます' +
      '（観点表 1.0 節 規定 10・Phase 6 Round 3 FIND-R3-C01）。\n' +
      '検出した既存データ:\n' +
      lines.join('\n') +
      '\n\n対処方法: DATABASE_URL を開発用 DB とは別の DB に向けて実行してください。例:\n' +
      "  DATABASE_URL='postgres://workhub:workhub_dev@localhost:5432/workhub_test' npm run test:integration",
  )
}

// このヘルパーを import した各テストファイルの最初のテスト（および最初の `beforeAll`）より前に、
// 1 回だけスナップショットを取り、続けて対象日付の非空チェック（ガードA）を行う。
beforeAll(async () => {
  await capturePreWriteSnapshot()
  await assertGuardDatesAreEmpty()
})

/**
 * 指定した日付の `time_entries` → `daily_reports` のうち、
 * **保存前スナップショットに無い（＝テストが書き込んだ）行だけ**を削除する（規定 3 の前半）。
 */
export async function deleteByDates(dates: string[]): Promise<void> {
  if (dates.length === 0) return

  if (!preWriteSnapshot) {
    // 安全側：スナップショット未取得なら無条件削除に退行せず何もしない
    console.warn(
      '[report-db-helpers] deleteByDates: 保存前スナップショットが未取得のため削除をスキップしました（対象日: ' +
        dates.join(', ') +
        '）',
    )
    return
  }
  const { timeEntryIds, dailyReportIds } = preWriteSnapshot

  const teRows = await testDb
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(inArray(timeEntries.date, dates))
  const teTargets = selectDeleteTargetIds(
    teRows.map((row) => row.id),
    timeEntryIds,
  )
  if (teTargets.length > 0) {
    await testDb.delete(timeEntries).where(inArray(timeEntries.id, teTargets))
  }

  const drRows = await testDb
    .select({ id: dailyReports.id })
    .from(dailyReports)
    .where(inArray(dailyReports.date, dates))
  const drTargets = selectDeleteTargetIds(
    drRows.map((row) => row.id),
    dailyReportIds,
  )
  if (drTargets.length > 0) {
    await testDb.delete(dailyReports).where(inArray(dailyReports.id, drTargets))
  }
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

/**
 * Phase 6 Round 4 FIND-R4-M03（Minor）：`deleteByDates` の id フィルタを
 * 純粋関数 `selectDeleteTargetIds` に抽出したのと同型のインライン filter が
 * ここにも残っていた（規定 4 の固定名防御）。同じ検出力空洞を避けるため、
 * ここでも `selectDeleteTargetIds` を再利用する（挙動は変えない）。
 */
async function deleteNewRows(
  label: string,
  currentIds: string[],
  knownIds: string[],
  run: (ids: string[]) => Promise<unknown>,
): Promise<void> {
  const targets = selectDeleteTargetIds(currentIds, new Set(knownIds))
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
