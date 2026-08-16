import { generateId } from './time-utils'
import type { Task, Project, DailyReportData } from './types'

export function defaultTask(): Task {
  return {
    id: generateId(),
    label: '',
    name: '',
    plannedHours: '',
    actualHours: '',
    progressBefore: '',
    progressExpected: '',
    progressActual: '',
  }
}

export function defaultProject(): Project {
  return {
    id: generateId(),
    name: '',
    plannedHours: '',
    tasks: [defaultTask()],
  }
}

export function defaultDailyReport(date?: string): DailyReportData {
  return {
    date: date ?? new Date().toISOString().slice(0, 10),
    startTime: '9:00',
    endTime: '18:00',
    breakTime: '1:00',
    note: '',
    projects: [defaultProject()],
    goodPoints: '',
    badPoints: '',
    nextPlan: '',
  }
}
