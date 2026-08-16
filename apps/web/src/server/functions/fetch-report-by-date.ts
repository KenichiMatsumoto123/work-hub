import { db } from '../db'
import { dailyReports } from '../schema'
import { eq } from 'drizzle-orm'
import type { DailyReportData } from '~/lib/types'
import { isValidReportDate } from '../report-normalize'

/** DB行 → DailyReportData 変換 */
export function rowToReport(row: typeof dailyReports.$inferSelect): DailyReportData {
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

export async function fetchReportByDate(date: string): Promise<DailyReportData | null> {
  if (!isValidReportDate(date)) {
    return null
  }

  const rows = await db
    .select()
    .from(dailyReports)
    .where(eq(dailyReports.date, date))
    .limit(1)

  if (rows.length === 0) return null
  return rowToReport(rows[0])
}
