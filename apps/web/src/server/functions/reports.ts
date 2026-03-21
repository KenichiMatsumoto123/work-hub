/**
 * 日報データの DB 操作関数
 * サーバーサイドでのみ使用（API ハンドラから呼び出す）
 */
import { db } from '../db'
import { dailyReports } from '../schema'
import { eq, and, gte, lt } from 'drizzle-orm'
import type { DailyReportData } from '~/lib/types'
import { parseTime } from '~/lib/time-utils'

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

export async function getAllReports(): Promise<Record<string, DailyReportData>> {
  const rows = await db.select().from(dailyReports).orderBy(dailyReports.date)
  const result: Record<string, DailyReportData> = {}
  for (const row of rows) {
    result[row.date] = rowToReport(row)
  }
  return result
}

export async function getReportsByMonth(
  year: number,
  month: number,
): Promise<DailyReportData[]> {
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
}

export async function saveReportToDb(data: DailyReportData): Promise<void> {
  const workHours =
    parseTime(data.endTime) - parseTime(data.startTime) - parseTime(data.breakTime)

  await db
    .insert(dailyReports)
    .values({
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      breakTime: data.breakTime,
      totalWorkHours: String(Math.max(0, workHours)),
      note: data.note || null,
      goodPoints: data.goodPoints || null,
      badPoints: data.badPoints || null,
      nextPlan: data.nextPlan || null,
      rawData: data as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: dailyReports.date,
      set: {
        startTime: data.startTime,
        endTime: data.endTime,
        breakTime: data.breakTime,
        totalWorkHours: String(Math.max(0, workHours)),
        note: data.note || null,
        goodPoints: data.goodPoints || null,
        badPoints: data.badPoints || null,
        nextPlan: data.nextPlan || null,
        rawData: data as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    })
}

export async function deleteReportFromDb(date: string): Promise<void> {
  await db.delete(dailyReports).where(eq(dailyReports.date, date))
}
