export interface Task {
  id: string
  label: string
  name: string
  plannedHours: string
  actualHours: string
  progressBefore: string
  progressExpected: string
  progressActual: string
}

export interface Project {
  id: string
  name: string
  plannedHours: string
  tasks: Task[]
}

export interface DailyReportData {
  date: string
  startTime: string
  endTime: string
  breakTime: string
  note: string
  projects: Project[]
  goodPoints: string
  badPoints: string
  nextPlan: string
}

/** localStorage に保存する日報データの集合 */
export interface StoredReports {
  [date: string]: DailyReportData // "2026-03-18": { ... }
}
