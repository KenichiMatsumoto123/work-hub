import type { DailyReportData, StoredReports } from './types'
import {
  getAllReportsFn,
  getReportsByMonthFn,
  saveReportFn,
  deleteReportFn,
  getReportByDateFn,
} from '~/server/functions/reports'

/** localStorage wrapper（テンプレート保存用） */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
}

/** sessionStorage wrapper（autosave用） */
export const session = {
  get(key: string): string | null {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): boolean {
    try {
      sessionStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
}

/** 日報の永続保存（PostgreSQL via createServerFn） */
export const reportStorage = {
  async getAll(): Promise<StoredReports> {
    try {
      return await getAllReportsFn()
    } catch {
      return {}
    }
  },

  async save(data: DailyReportData): Promise<{ ok: boolean; error?: string }> {
    try {
      const result = await saveReportFn({ data })
      return { ok: result.success === true }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return { ok: false, error }
    }
  },

  async delete(date: string): Promise<boolean> {
    try {
      const result = await deleteReportFn({ data: { date } })
      return result.success === true
    } catch {
      return false
    }
  },

  async getByMonth(year: number, month: number): Promise<DailyReportData[]> {
    try {
      return await getReportsByMonthFn({ data: { year, month } })
    } catch {
      return []
    }
  },

  async getByDate(date: string): Promise<DailyReportData | null> {
    try {
      return await getReportByDateFn({ data: { date } })
    } catch {
      return null
    }
  },
}
