import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { AttendanceTable } from '~/components/report/AttendanceTable'
import { reportStorage } from '~/lib/storage'
import { Button } from '~/components/ui/Button'
import type { DailyReportData } from '~/lib/types'
import '~/styles/app.css'

export const Route = createFileRoute('/_authed/attendance')({
  component: AttendancePage,
})

function AttendancePage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [reports, setReports] = useState<DailyReportData[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch reports from DB when year/month changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    reportStorage.getByMonth(year, month).then((data) => {
      if (!cancelled) {
        setReports(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [year, month])

  const changeMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setYear(y)
    setMonth(m)
  }

  return (
    <div className="px-6 py-5 max-w-[1200px] mx-auto">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-5">
        <Button variant="ghost" onClick={() => changeMonth(-1)}>◀</Button>
        <span className="text-lg font-bold font-mono">{year}年{String(month).padStart(2, '0')}月</span>
        <Button variant="ghost" onClick={() => changeMonth(1)}>▶</Button>
      </div>

      {/* Month tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            className={`border rounded-md px-2.5 py-1 text-[13px] cursor-pointer transition-all duration-150 ${
              month === m
                ? 'bg-accent text-white border-accent font-semibold'
                : 'bg-surface text-text-dim border-border hover:bg-surface-hover'
            }`}
          >
            {m}月
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-dim">
          <p>読み込み中...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-dim">
          <p className="text-lg mb-2">データがありません</p>
          <p className="text-[13px]">{year}年{month}月の日報が保存されていません。日報入力画面から保存してください。</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-4">
          <AttendanceTable year={year} month={month} reports={reports} />
        </div>
      )}
    </div>
  )
}
