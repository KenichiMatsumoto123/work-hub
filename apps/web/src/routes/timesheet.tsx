import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { MonthlyTimesheetTable } from '~/components/report/MonthlyTimesheetTable'
import { reportStorage } from '~/lib/storage'
import { Button } from '~/components/ui/Button'
import '~/styles/app.css'

export const Route = createFileRoute('/timesheet')({
  component: TimesheetPage,
})

function TimesheetPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedProject, setSelectedProject] = useState<string>('')

  const reports = useMemo(() => reportStorage.getByMonth(year, month), [year, month])

  // Collect all unique project names from the month's reports
  const projectNames = useMemo(() => {
    const names = new Set<string>()
    for (const r of reports) {
      for (const p of r.projects) {
        if (p.name) names.add(p.name)
      }
    }
    return Array.from(names).sort()
  }, [reports])

  // Auto-select first project if none selected
  const activeProject = selectedProject || projectNames[0] || ''

  const changeMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setYear(y)
    setMonth(m)
  }

  return (
    <div className="px-6 py-5 max-w-[1100px] mx-auto">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => changeMonth(-1)}>◀</Button>
          <span className="text-lg font-bold font-mono">{year}年{String(month).padStart(2, '0')}月</span>
          <Button variant="ghost" onClick={() => changeMonth(1)}>▶</Button>
        </div>

        {projectNames.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {projectNames.map((name) => (
              <button
                key={name}
                onClick={() => setSelectedProject(name)}
                className={`border rounded-md px-3 py-1.5 text-[13px] cursor-pointer transition-all duration-150 ${
                  activeProject === name
                    ? 'bg-accent text-white border-accent font-semibold'
                    : 'bg-surface text-text-dim border-border hover:bg-surface-hover'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {reports.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-dim">
          <p className="text-lg mb-2">データがありません</p>
          <p className="text-[13px]">{year}年{month}月の日報が保存されていません。日報入力画面から保存してください。</p>
        </div>
      ) : activeProject ? (
        <div className="bg-surface border border-border rounded-lg p-4">
          <MonthlyTimesheetTable
            year={year}
            month={month}
            projectName={activeProject}
            reports={reports}
          />
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-dim">
          <p>プロジェクトが見つかりません</p>
        </div>
      )}
    </div>
  )
}
