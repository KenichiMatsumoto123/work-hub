import type { DailyReportData, StoredReports } from './types'

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

/** 日報の永続保存（PostgreSQL via API） */
export const reportStorage = {
  async getAll(): Promise<StoredReports> {
    try {
      const res = await fetch('/api/reports')
      return await res.json()
    } catch {
      return {}
    }
  },

  async save(data: DailyReportData): Promise<boolean> {
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      return result.success === true
    } catch {
      return false
    }
  },

  async delete(date: string): Promise<boolean> {
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', date }),
      })
      const result = await res.json()
      return result.success === true
    } catch {
      return false
    }
  },

  async getByMonth(year: number, month: number): Promise<DailyReportData[]> {
    try {
      const res = await fetch(`/api/reports?year=${year}&month=${month}`)
      return await res.json()
    } catch {
      return []
    }
  },
}
