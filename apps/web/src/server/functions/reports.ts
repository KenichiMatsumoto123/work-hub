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
import { eq, and, or, gte, lt, inArray, sql } from 'drizzle-orm'
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
 * M-1〜M-3 共通のバッチ版：「見つかればその ID を使う → 見つからなければ作成」を
 * キー集合に対して 1 回の複数行 `INSERT ... ON CONFLICT DO NOTHING` ＋ 1 回の複数行
 * 再 SELECT で行う（設計書「解決の順序」節のシーケンス図が示す「まとめて解決」の形。
 * 名前ごとに 1 文ずつ発行すると、異なる日付の保存が同時に新規マスタ群を作るときに
 * ABBA デッドロックが構造的に組み上がる。1 文の複数行 INSERT では最初の行で
 * 直列化されるためこの経路が成立しない）。
 *
 * `sortedKeys` は「解決の順序」に従ってソート済みであることを呼び出し元が保証する。
 * INSERT の VALUES の並び順は `sortedKeys` の順序をそのまま使う（フィルタは順序を
 * 保存する）ため、全トランザクションで行ロックの取得順序が一致する。
 *
 * 再 SELECT で見つからないキーが残った場合、挿入と再検索をちょうど 1 回だけ
 * やり直す。それでも解決できなければエラーを投げてトランザクションを中断する
 * （AC-64。単一キー版の「初回 SELECT →（INSERT＋再 SELECT）を最大 2 回」という
 * 終端条件を、キー集合全体に対して保ったまま踏襲する）。
 */
async function resolveBatchWithRetry<K>(
  sortedKeys: K[],
  keyToString: (key: K) => string,
  labelOf: (key: K) => string,
  select: (keys: K[]) => Promise<Map<string, string>>,
  insert: (keys: K[]) => Promise<unknown>,
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>()
  if (sortedKeys.length === 0) return resolved

  const applySelect = async (keys: K[]) => {
    const found = await select(keys)
    for (const [key, id] of found) resolved.set(key, id)
  }

  await applySelect(sortedKeys)
  let pending = sortedKeys.filter((key) => !resolved.has(keyToString(key)))

  for (let attempt = 0; attempt < 2 && pending.length > 0; attempt += 1) {
    await insert(pending)
    await applySelect(pending)
    pending = pending.filter((key) => !resolved.has(keyToString(key)))
  }

  if (pending.length > 0) {
    throw new Error(`マスタの解決に失敗しました: ${pending.map(labelOf).join(', ')}`)
  }

  return resolved
}

/**
 * M-1: 取引先（`clients`）。検索キー：`name = normalizeName(Project.name)`。
 * `sortedNames` は正規化後の名前の昇順（解決の順序 1.）。
 */
async function resolveClientIds(tx: Tx, sortedNames: string[]): Promise<Map<string, string>> {
  return resolveBatchWithRetry(
    sortedNames,
    (name) => name,
    (name) => name,
    async (names) => {
      const rows = await tx
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(inArray(clients.name, names))
      return new Map(rows.map((row) => [row.name, row.id]))
    },
    (names) =>
      tx
        .insert(clients)
        .values(names.map((name) => ({ name })))
        .onConflictDoNothing({ target: clients.name }),
  )
}

type ProjectKey = { clientId: string; name: string }

/** プロジェクトのキー文字列（衝突しない形式。M-4 と同じ `JSON.stringify` 方式） */
function projectKeyString(clientId: string, name: string): string {
  return JSON.stringify([clientId, name])
}

/**
 * M-2: プロジェクト（`projects`）。
 * 検索キー：`client_id = <解決済み取引先ID> AND name = normalizeName(Task.label)`。
 * `sortedKeys` は `(取引先ID, 正規化後の名前)` の昇順（解決の順序 2.）。
 */
async function resolveProjectIds(
  tx: Tx,
  sortedKeys: ProjectKey[],
): Promise<Map<string, string>> {
  return resolveBatchWithRetry(
    sortedKeys,
    (key) => projectKeyString(key.clientId, key.name),
    (key) => key.name,
    async (keys) => {
      const rows = await tx
        .select({ id: projects.id, clientId: projects.clientId, name: projects.name })
        .from(projects)
        .where(or(...keys.map((key) => and(eq(projects.clientId, key.clientId), eq(projects.name, key.name)))))
      return new Map(rows.map((row) => [projectKeyString(row.clientId, row.name), row.id]))
    },
    (keys) =>
      tx
        .insert(projects)
        .values(keys.map(({ clientId, name }) => ({ clientId, name })))
        .onConflictDoNothing({ target: [projects.clientId, projects.name] }),
  )
}

/**
 * M-3: タスク（`tasks`）。検索キー：`project_id`・`client_id`・`title` の 3 つ組。
 * NULL を含む比較には `IS NOT DISTINCT FROM` を用いる（`eq()` の `= NULL` は
 * 三値論理で常に UNKNOWN になり、adhoc タスクが決してヒットしないため）。
 * `sortedKeys` は `(project_id, client_id, title)` の昇順・NULL 最小（解決の順序 3.）。
 */
async function resolveTaskIds(
  tx: Tx,
  sortedKeys: ResolvedTaskKey[],
): Promise<Map<string, string>> {
  return resolveBatchWithRetry(
    sortedKeys,
    (key) => taskKeyString(key),
    (key) => key.title,
    async (keys) => {
      const conditions = keys.map(
        (key) => sql`(${tasks.projectId} IS NOT DISTINCT FROM ${key.projectId}
          AND ${tasks.clientId} IS NOT DISTINCT FROM ${key.clientId}
          AND ${tasks.title} = ${key.title})`,
      )
      const rows = await tx
        .select({ id: tasks.id, projectId: tasks.projectId, clientId: tasks.clientId, title: tasks.title })
        .from(tasks)
        .where(sql.join(conditions, sql` OR `))
      return new Map(
        rows.map((row) => [
          taskKeyString({ projectId: row.projectId, clientId: row.clientId, title: row.title }),
          row.id,
        ]),
      )
    },
    (keys) =>
      tx
        .insert(tasks)
        .values(keys.map((key) => ({ type: key.type, title: key.title, projectId: key.projectId, clientId: key.clientId })))
        .onConflictDoNothing({ target: [tasks.projectId, tasks.clientId, tasks.title] }),
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

/** タスクのキー文字列（衝突しない形式。M-4 節が規定する `JSON.stringify` 方式） */
function taskKeyString(key: { projectId: string | null; clientId: string | null; title: string }): string {
  return JSON.stringify([key.projectId, key.clientId, key.title])
}

/**
 * マスタ（取引先 → プロジェクト → タスク）を「解決の順序」に従ってまとめて解決し、
 * `time_entries` へ挿入する行を組み立てる（T-1 トランザクション内手順 4・5）。
 *
 * 各フェーズは「重複排除済みキー集合に対する 1 回の複数行 INSERT ＋ 1 回の複数行
 * 再 SELECT」（`resolveClientIds` / `resolveProjectIds` / `resolveTaskIds`）で解決する。
 * 重複排除（`Set` / `Map` によるキー収集）が M-4 の同一保存内キャッシュを兼ねる
 * （同じキーを 2 回 DB に問い合わせない）。
 */
async function resolveMastersAndInsertEntries(
  tx: Tx,
  date: string,
  targetRows: TargetRow[],
): Promise<void> {
  // 1. 取引先：正規化後の名前の昇順に解決する（M-4：Set で重複排除 = キャッシュ）
  const clientNames = Array.from(
    new Set(
      targetRows
        .map((row) => row.identity.clientName)
        .filter((name): name is string => name !== null),
    ),
  ).sort()

  const clientIdByName = await resolveClientIds(tx, clientNames)

  // 2. プロジェクト：(取引先ID, 正規化後の名前) の昇順に解決する
  //    （取引先が空の行の projectName は resolveTaskIdentity により常に null なので対象外）
  //    M-4：Map で重複排除 = キャッシュ
  const projectKeys = new Map<string, ProjectKey>()
  for (const row of targetRows) {
    const { identity } = row
    if (identity.type === 'project' && identity.clientName !== null && identity.projectName !== null) {
      const clientId = clientIdByName.get(identity.clientName)
      if (clientId === undefined) continue
      const key = projectKeyString(clientId, identity.projectName)
      if (!projectKeys.has(key)) {
        projectKeys.set(key, { clientId, name: identity.projectName })
      }
    }
  }
  const sortedProjectKeys = Array.from(projectKeys.values()).sort((a, b) => {
    const byClient = compareNullableString(a.clientId, b.clientId)
    return byClient !== 0 ? byClient : compareNullableString(a.name, b.name)
  })

  const projectIdByKey = await resolveProjectIds(tx, sortedProjectKeys)

  /** 行から解決済みの (type, projectId, clientId, title) を得る（DB へは触れない） */
  function resolvedKeyOf(row: TargetRow): ResolvedTaskKey {
    const { identity } = row
    const clientId = identity.clientName !== null ? (clientIdByName.get(identity.clientName) ?? null) : null
    const projectId =
      identity.type === 'project' && identity.projectName !== null && clientId !== null
        ? (projectIdByKey.get(projectKeyString(clientId, identity.projectName)) ?? null)
        : null
    return { type: identity.type, projectId, clientId, title: identity.title }
  }

  // 3. タスク：(project_id, client_id, title) の昇順（NULL は最小）に解決する
  //    M-4：Map で重複排除 = キャッシュ
  const taskKeys = new Map<string, ResolvedTaskKey>()
  for (const row of targetRows) {
    const key = resolvedKeyOf(row)
    const keyString = taskKeyString(key)
    if (!taskKeys.has(keyString)) taskKeys.set(keyString, key)
  }
  const sortedTaskKeys = Array.from(taskKeys.values()).sort((a, b) => {
    const byProject = compareNullableString(a.projectId, b.projectId)
    if (byProject !== 0) return byProject
    const byClient = compareNullableString(a.clientId, b.clientId)
    if (byClient !== 0) return byClient
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0
  })

  const taskIdByKey = await resolveTaskIds(tx, sortedTaskKeys)

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

export const getReportByDateFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { date: string }) => data)
  .handler(async () => {
    throw new Error('STUB: getReportByDateFn')
  })
