import { formatDateShort, formatHours, parseTime } from './time-utils'
import type { DailyReportData, Project } from './types'

/** (1) 日報テキスト生成 */
export function generateDailyReport(data: DailyReportData): string {
  const dateShort = formatDateShort(data.date)
  const lines: string[] = [`＜${dateShort} 作業報告＞`]

  for (const proj of data.projects) {
    if (!proj.name) continue
    const tp = proj.tasks.reduce((s, t) => s + (parseFloat(t.plannedHours) || 0), 0)
    const ta = proj.tasks.reduce((s, t) => s + (parseFloat(t.actualHours) || 0), 0)
    lines.push(`■${proj.name}（${tp}h → ${ta}h）`)
    for (const t of proj.tasks) {
      if (!t.name) continue
      const label = t.label ? `【${t.label}】` : ''
      lines.push(
        `${label}${t.name}（${t.plannedHours || '0'}h → ${t.actualHours || '0'}h）作業前：${t.progressBefore || ''}％ 見込：${t.progressExpected || ''}％ 実績：${t.progressActual || ''}％`
      )
    }
  }

  if (data.goodPoints.trim()) {
    lines.push('', `＜よかった点＞`, data.goodPoints.trim())
  }
  if (data.badPoints.trim()) {
    lines.push('', `＜課題点＞`, data.badPoints.trim())
  }
  if (data.nextPlan.trim()) {
    lines.push('', `＜次回の稼働予定＞`, data.nextPlan.trim())
  }

  return lines.join('\n')
}

/** (2) プロジェクト別の工数サマリー（1日分） */
export function getProjectSummary(proj: Project) {
  const totalActual = proj.tasks.reduce((s, t) => s + (parseFloat(t.actualHours) || 0), 0)
  const content = proj.tasks
    .filter((t) => t.name && parseFloat(t.actualHours) > 0)
    .map((t) => `${t.label ? t.label + '：' : ''}${t.name}`)
    .join('\n')
  const breakH = totalActual > 4 ? 1 : 0
  return {
    name: proj.name,
    startTime: '9:00',
    endTime: formatHours(9 + totalActual + breakH),
    breakTime: formatHours(breakH),
    workTime: formatHours(totalActual),
    content,
    totalActual,
  }
}

/** (3) 勤怠データ */
export function getAttendanceData(data: DailyReportData) {
  return {
    startTime: data.startTime,
    endTime: data.endTime,
    breakTime: data.breakTime,
  }
}
