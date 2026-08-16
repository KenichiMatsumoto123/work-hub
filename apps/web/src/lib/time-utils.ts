export const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const

export function getToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function getDayName(dateStr: string): string {
  return DAY_NAMES[new Date(dateStr).getDay()]
}

export function parseTime(t: string): number {
  if (!t) return 0
  const parts = t.split(':').map(Number)
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  if (isNaN(h) || isNaN(m)) return 0
  return h + m / 60
}

export function formatHours(h: number): string {
  const totalMins = Math.round(h * 60)
  const hrs = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  return `${hrs}:${String(mins).padStart(2, '0')}`
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** Get all dates in a given month (YYYY-MM-DD format) */
export function getDatesInMonth(year: number, month: number): string[] {
  const dates: string[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    dates.push(dateStr)
  }
  return dates
}
