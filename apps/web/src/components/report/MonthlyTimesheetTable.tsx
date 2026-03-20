import { getDatesInMonth, getDayName, formatHours, parseTime } from '~/lib/time-utils'
import { getProjectSummary } from '~/lib/report-generator'
import type { DailyReportData } from '~/lib/types'

interface Props {
  year: number
  month: number
  projectName: string
  reports: DailyReportData[]
}

export function MonthlyTimesheetTable({ year, month, projectName, reports }: Props) {
  const dates = getDatesInMonth(year, month)
  const reportMap = new Map(reports.map((r) => [r.date, r]))

  type Row = {
    date: string
    day: string
    startTime: string
    endTime: string
    breakTime: string
    workTime: string
    content: string
    workHours: number
    isWeekend: boolean
  }

  const rows: Row[] = dates.map((date) => {
    const d = new Date(date)
    const day = getDayName(date)
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const report = reportMap.get(date)

    if (!report) {
      return { date, day, startTime: '', endTime: '', breakTime: '', workTime: '', content: '', workHours: 0, isWeekend }
    }

    const proj = report.projects.find((p) => p.name === projectName)
    if (!proj) {
      return { date, day, startTime: '', endTime: '', breakTime: '', workTime: '', content: '', workHours: 0, isWeekend }
    }

    const summary = getProjectSummary(proj)
    if (summary.totalActual === 0) {
      return { date, day, startTime: '', endTime: '', breakTime: '', workTime: '', content: '', workHours: 0, isWeekend }
    }

    return {
      date,
      day,
      startTime: summary.startTime,
      endTime: summary.endTime,
      breakTime: summary.breakTime,
      workTime: summary.workTime,
      content: summary.content,
      workHours: summary.totalActual,
      isWeekend,
    }
  })

  const totalWorkHours = rows.reduce((sum, r) => sum + r.workHours, 0)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.getDate()
  }

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">
          {year}年{month}月 — {projectName}
        </h3>
        <div className="bg-tag rounded-md px-3 py-1.5 text-[13px] font-semibold font-mono">
          合計: {formatHours(totalWorkHours)}
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-surface">
            <th className="border border-border px-2 py-1.5 text-left w-[50px]">日付</th>
            <th className="border border-border px-2 py-1.5 text-center w-[36px]">曜日</th>
            <th className="border border-border px-2 py-1.5 text-center w-[70px]">作業開始</th>
            <th className="border border-border px-2 py-1.5 text-center w-[70px]">作業終了</th>
            <th className="border border-border px-2 py-1.5 text-center w-[50px]">休憩</th>
            <th className="border border-border px-2 py-1.5 text-center w-[70px]">作業時間</th>
            <th className="border border-border px-2 py-1.5 text-left">作業内容</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.date}
              className={
                row.isWeekend
                  ? 'bg-[#1a1525] text-text-muted'
                  : row.workHours > 0
                    ? 'bg-bg'
                    : 'bg-bg text-text-muted'
              }
            >
              <td className="border border-border px-2 py-1">{formatDate(row.date)}</td>
              <td
                className={`border border-border px-2 py-1 text-center ${
                  row.day === '日' ? 'text-danger' : row.day === '土' ? 'text-accent' : ''
                }`}
              >
                {row.day}
              </td>
              <td className="border border-border px-2 py-1 text-center font-mono">{row.startTime}</td>
              <td className="border border-border px-2 py-1 text-center font-mono">{row.endTime}</td>
              <td className="border border-border px-2 py-1 text-center font-mono">{row.breakTime}</td>
              <td className="border border-border px-2 py-1 text-center font-mono">{row.workTime}</td>
              <td className="border border-border px-2 py-1 whitespace-pre-wrap">{row.content}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-surface font-semibold">
            <td colSpan={5} className="border border-border px-2 py-1.5 text-right">
              合計
            </td>
            <td className="border border-border px-2 py-1.5 text-center font-mono">
              {formatHours(totalWorkHours)}
            </td>
            <td className="border border-border px-2 py-1.5"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
