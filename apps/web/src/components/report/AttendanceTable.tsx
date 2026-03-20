import { getDatesInMonth, getDayName, formatHours, parseTime } from '~/lib/time-utils'
import type { DailyReportData } from '~/lib/types'

interface Props {
  year: number
  month: number
  reports: DailyReportData[]
}

const STANDARD_WORK_HOURS = 8

export function AttendanceTable({ year, month, reports }: Props) {
  const dates = getDatesInMonth(year, month)
  const reportMap = new Map(reports.map((r) => [r.date, r]))

  type Row = {
    date: string
    dayNum: number
    day: string
    category: string // 稼/休/有 etc.
    startTime: string
    endTime: string
    breakTime: string
    workHours: number
    lateEarlyHours: number // 遅早時間
    overtimeHours: number // 残業時間
    holidayWorkHours: number // 休出時間
    lateNightHours: number // 深夜時間
    note: string
    isWeekend: boolean
  }

  const rows: Row[] = dates.map((date) => {
    const d = new Date(date)
    const dayNum = d.getDate()
    const day = getDayName(date)
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const report = reportMap.get(date)

    if (!report) {
      return {
        date, dayNum, day,
        category: isWeekend ? '休' : '',
        startTime: '', endTime: '', breakTime: '',
        workHours: 0, lateEarlyHours: 0, overtimeHours: 0,
        holidayWorkHours: 0, lateNightHours: 0,
        note: '', isWeekend,
      }
    }

    const startH = parseTime(report.startTime)
    const endH = parseTime(report.endTime)
    const breakH = parseTime(report.breakTime)
    const workHours = Math.max(0, endH - startH - breakH)

    const lateEarlyHours = Math.max(0, STANDARD_WORK_HOURS - workHours)
    const overtimeHours = Math.max(0, workHours - STANDARD_WORK_HOURS)
    const holidayWorkHours = isWeekend ? workHours : 0
    // 深夜: 22時以降 or 5時以前の勤務時間（簡易計算）
    const lateNightHours = endH > 22 ? endH - 22 : 0

    return {
      date, dayNum, day,
      category: isWeekend ? (workHours > 0 ? '休出' : '休') : '稼',
      startTime: report.startTime,
      endTime: report.endTime,
      breakTime: report.breakTime,
      workHours,
      lateEarlyHours: isWeekend ? 0 : lateEarlyHours,
      overtimeHours,
      holidayWorkHours,
      lateNightHours,
      note: report.note || '',
      isWeekend,
    }
  })

  const workingDays = rows.filter((r) => r.category === '稼').length
  const totalWork = rows.reduce((s, r) => s + r.workHours, 0)
  const totalOvertime = rows.reduce((s, r) => s + r.overtimeHours, 0)
  const totalLateEarly = rows.reduce((s, r) => s + r.lateEarlyHours, 0)
  const totalHolidayWork = rows.reduce((s, r) => s + r.holidayWorkHours, 0)
  const totalLateNight = rows.reduce((s, r) => s + r.lateNightHours, 0)

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">
          {year}年{month}月 勤怠管理表
        </h3>
        <div className="flex gap-3 text-[13px]">
          <span className="bg-tag rounded-md px-2.5 py-1 font-mono">出勤: {workingDays}日</span>
          <span className="bg-tag rounded-md px-2.5 py-1 font-mono">勤務: {formatHours(totalWork)}</span>
          <span className="bg-tag rounded-md px-2.5 py-1 font-mono">残業: {formatHours(totalOvertime)}</span>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-surface">
            <th className="border border-border px-2 py-1.5 text-left w-[40px]">日</th>
            <th className="border border-border px-2 py-1.5 text-center w-[32px]">曜</th>
            <th className="border border-border px-2 py-1.5 text-center w-[40px]">区分</th>
            <th className="border border-border px-2 py-1.5 text-center w-[60px]">始業</th>
            <th className="border border-border px-2 py-1.5 text-center w-[60px]">終業</th>
            <th className="border border-border px-2 py-1.5 text-center w-[50px]">休憩</th>
            <th className="border border-border px-2 py-1.5 text-center w-[65px]">勤務時間</th>
            <th className="border border-border px-2 py-1.5 text-center w-[65px]">遅早時間</th>
            <th className="border border-border px-2 py-1.5 text-center w-[65px]">残業時間</th>
            <th className="border border-border px-2 py-1.5 text-center w-[65px]">休出時間</th>
            <th className="border border-border px-2 py-1.5 text-center w-[65px]">深夜時間</th>
            <th className="border border-border px-2 py-1.5 text-left">備考</th>
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
              <td className="border border-border px-2 py-1">{row.dayNum}</td>
              <td
                className={`border border-border px-2 py-1 text-center ${
                  row.day === '日' ? 'text-danger' : row.day === '土' ? 'text-accent' : ''
                }`}
              >
                {row.day}
              </td>
              <td className="border border-border px-2 py-1 text-center">{row.category}</td>
              <td className="border border-border px-2 py-1 text-center font-mono">{row.startTime}</td>
              <td className="border border-border px-2 py-1 text-center font-mono">{row.endTime}</td>
              <td className="border border-border px-2 py-1 text-center font-mono">{row.breakTime}</td>
              <td className="border border-border px-2 py-1 text-center font-mono">
                {row.workHours > 0 ? formatHours(row.workHours) : ''}
              </td>
              <td className="border border-border px-2 py-1 text-center font-mono">
                {row.lateEarlyHours > 0 ? formatHours(row.lateEarlyHours) : ''}
              </td>
              <td className="border border-border px-2 py-1 text-center font-mono">
                {row.overtimeHours > 0 ? formatHours(row.overtimeHours) : ''}
              </td>
              <td className="border border-border px-2 py-1 text-center font-mono">
                {row.holidayWorkHours > 0 ? formatHours(row.holidayWorkHours) : ''}
              </td>
              <td className="border border-border px-2 py-1 text-center font-mono">
                {row.lateNightHours > 0 ? formatHours(row.lateNightHours) : ''}
              </td>
              <td className="border border-border px-2 py-1">{row.note}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-surface font-semibold">
            <td colSpan={3} className="border border-border px-2 py-1.5 text-right">
              合計（出勤 {workingDays}日）
            </td>
            <td colSpan={3} className="border border-border px-2 py-1.5"></td>
            <td className="border border-border px-2 py-1.5 text-center font-mono">{formatHours(totalWork)}</td>
            <td className="border border-border px-2 py-1.5 text-center font-mono">
              {totalLateEarly > 0 ? formatHours(totalLateEarly) : ''}
            </td>
            <td className="border border-border px-2 py-1.5 text-center font-mono">
              {totalOvertime > 0 ? formatHours(totalOvertime) : ''}
            </td>
            <td className="border border-border px-2 py-1.5 text-center font-mono">
              {totalHolidayWork > 0 ? formatHours(totalHolidayWork) : ''}
            </td>
            <td className="border border-border px-2 py-1.5 text-center font-mono">
              {totalLateNight > 0 ? formatHours(totalLateNight) : ''}
            </td>
            <td className="border border-border px-2 py-1.5"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
