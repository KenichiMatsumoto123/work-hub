import type { DailyReportData, StoredReports } from './types'

const REPORTS_KEY = 'daily-reports'

/** localStorage wrapper */
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

/** sessionStorage wrapper */
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

/** 日報の永続保存（localStorage） */
export const reportStorage = {
  getAll(): StoredReports {
    const raw = storage.get(REPORTS_KEY)
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  },

  get(date: string): DailyReportData | null {
    const all = this.getAll()
    return all[date] ?? null
  },

  save(data: DailyReportData): boolean {
    const all = this.getAll()
    all[data.date] = data
    return storage.set(REPORTS_KEY, JSON.stringify(all))
  },

  delete(date: string): boolean {
    const all = this.getAll()
    delete all[date]
    return storage.set(REPORTS_KEY, JSON.stringify(all))
  },

  getByMonth(year: number, month: number): DailyReportData[] {
    const all = this.getAll()
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    return Object.entries(all)
      .filter(([date]) => date.startsWith(prefix))
      .map(([, data]) => data)
      .sort((a, b) => a.date.localeCompare(b.date))
  },
}
