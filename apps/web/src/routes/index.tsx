import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState, useEffect } from 'react'
import { Input } from '~/components/ui/Input'
import { Button } from '~/components/ui/Button'
import { Label } from '~/components/ui/Label'
import { CopyButton } from '~/components/ui/CopyButton'
import { CellRow } from '~/components/ui/CellRow'
import { ProjectBlock } from '~/components/report/ProjectBlock'
import { ReflectionSection } from '~/components/report/ReflectionSection'
import { defaultProject, defaultDailyReport } from '~/lib/defaults'
import { generateDailyReport, getProjectSummary } from '~/lib/report-generator'
import { generateId } from '~/lib/time-utils'
import { storage, session, reportStorage } from '~/lib/storage'
import { defaultTask } from '~/lib/defaults'
import {
  savedMsgReducer,
  runSavedMsgEffects,
  initialSavedMsgState,
  type SavedMsgEvent,
} from '~/lib/saved-msg'
import type { DailyReportData, Project } from '~/lib/types'
import '~/styles/app.css'

export const Route = createFileRoute('/')({
  component: HomePage,
})

type TabId = 'input' | 'daily' | 'project' | 'attendance'

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`border-none rounded-lg cursor-pointer font-sans px-5 py-2.5 text-sm transition-all duration-150 ${
        active ? 'bg-accent text-white font-semibold' : 'bg-transparent text-text-dim font-normal'
      }`}
    >
      {children}
    </button>
  )
}

function HomePage() {
  const [data, setData] = useState<DailyReportData>(defaultDailyReport())
  const [activeTab, setActiveTab] = useState<TabId>('input')

  // 保存メッセージ（savedMsg）の状態管理は ~/lib/saved-msg.ts の reducer に委ねる
  // （設計書「UI の変更（エラー表示）> 実装構造の規定」）。コンポーネント側は
  // イベントの生成（ok 分岐）と、reducer の出力を state へ反映するだけの薄い層にする。
  const savedMsgStateRef = useRef(initialSavedMsgState)
  const [savedMsgState, setSavedMsgState] = useState(initialSavedMsgState)

  const sendSavedMsgEvent = (event: SavedMsgEvent) => {
    const result = savedMsgReducer(savedMsgStateRef.current, event)
    const timerId = runSavedMsgEffects(result.effects, {
      timers: {
        setTimeout: (callback, ms) => window.setTimeout(callback, ms),
        clearTimeout: (id) => window.clearTimeout(id),
      },
      dispatch: sendSavedMsgEvent,
    })
    const nextState = { ...result.state, timerId }
    savedMsgStateRef.current = nextState
    setSavedMsgState(nextState)
  }

  const update = <K extends keyof DailyReportData>(field: K, val: DailyReportData[K]) =>
    setData((prev) => ({ ...prev, [field]: val }))

  // Load: sessionStorage (autosave) > localStorage (template)
  useEffect(() => {
    const saved = session.get('daily-report-autosave')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setData((prev) => ({ ...prev, ...parsed }))
        return
      } catch {
        /* ignore */
      }
    }
    const tmpl = storage.get('daily-report-latest')
    if (tmpl) {
      try {
        const parsed = JSON.parse(tmpl)
        if (parsed.projects?.length > 0) {
          const templateProjects = parsed.projects.map((p: Project) => ({
            ...defaultProject(),
            id: generateId(),
            name: p.name,
            tasks: p.tasks.map((t: { label: string }) => ({
              ...defaultTask(),
              id: generateId(),
              label: t.label,
            })),
          }))
          setData((prev) => ({
            ...prev,
            projects: templateProjects,
            startTime: parsed.startTime || prev.startTime,
            endTime: parsed.endTime || prev.endTime,
            breakTime: parsed.breakTime || prev.breakTime,
          }))
        }
      } catch {
        /* ignore */
      }
    }
  }, [])

  // Autosave debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      session.set('daily-report-autosave', JSON.stringify(data))
    }, 500)
    return () => clearTimeout(timer)
  }, [data])

  const saveTemplate = () => {
    const ok = storage.set('daily-report-latest', JSON.stringify(data))
    sendSavedMsgEvent(ok ? { type: 'templateSaveSucceeded' } : { type: 'templateSaveFailed' })
  }

  const saveReport = async () => {
    if (!data.date) {
      sendSavedMsgEvent({ type: 'dateMissing' })
      return
    }
    const result = await reportStorage.save(data)
    if (result.ok) {
      sendSavedMsgEvent({ type: 'reportSaveSucceeded', date: data.date })
    } else {
      sendSavedMsgEvent({ type: 'reportSaveFailed', message: result.error ?? '' })
    }
  }

  const updateProject = (idx: number, proj: Project) => {
    const ps = [...data.projects]
    ps[idx] = proj
    update('projects', ps)
  }
  const removeProject = (idx: number) =>
    update(
      'projects',
      data.projects.filter((_, i) => i !== idx)
    )
  const addProject = () => update('projects', [...data.projects, defaultProject()])

  // Computed
  const dailyReport = generateDailyReport(data)
  const totalPlanned = data.projects.reduce(
    (s, p) => s + p.tasks.reduce((ss, t) => ss + (parseFloat(t.plannedHours) || 0), 0),
    0
  )
  const totalActual = data.projects.reduce(
    (s, p) => s + p.tasks.reduce((ss, t) => ss + (parseFloat(t.actualHours) || 0), 0),
    0
  )
  const projectSummaries = data.projects
    .filter((p) => p.name)
    .map(getProjectSummary)
    .filter((s) => s.totalActual > 0)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-br from-surface to-[#1e2235] border-b border-border px-6 py-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[28px]">📋</span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">日報・工数管理</h1>
            <p className="text-xs text-text-dim">1回の入力 → 3つのフォーマットを自動生成</p>
          </div>
        </div>
        <div className="flex gap-2.5 items-center flex-wrap">
          <Input
            type="date"
            value={data.date}
            onChange={(e) => update('date', e.target.value)}
            className="!w-[150px]"
          />
          <div className="flex items-center gap-1.5 bg-bg rounded-md px-2.5 py-1 border border-border">
            <Label>始業</Label>
            <Input
              value={data.startTime}
              onChange={(e) => update('startTime', e.target.value)}
              className="!w-[60px] !border-none !p-1"
            />
            <Label>終業</Label>
            <Input
              value={data.endTime}
              onChange={(e) => update('endTime', e.target.value)}
              className="!w-[60px] !border-none !p-1"
            />
            <Label>休憩</Label>
            <Input
              value={data.breakTime}
              onChange={(e) => update('breakTime', e.target.value)}
              className="!w-[60px] !border-none !p-1"
            />
          </div>
          <div className="bg-tag rounded-md px-3 py-1.5 text-[13px] font-semibold font-mono">
            合計: {totalPlanned}h → {totalActual}h
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface px-4 gap-1">
        <TabButton active={activeTab === 'input'} onClick={() => setActiveTab('input')}>
          ✏️ 入力
        </TabButton>
        <TabButton active={activeTab === 'daily'} onClick={() => setActiveTab('daily')}>
          📝 日報
        </TabButton>
        <TabButton active={activeTab === 'project'} onClick={() => setActiveTab('project')}>
          📊 PJ稼働
        </TabButton>
        <TabButton active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')}>
          🕐 勤怠
        </TabButton>
      </div>

      {/* Content */}
      <div className="px-6 py-5 max-w-[960px] mx-auto">
        {activeTab === 'input' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-text-dim">プロジェクト・タスク入力</h2>
              <div className="flex gap-2 items-center">
                {savedMsgState.message && (
                  <span
                    data-testid="saved-msg"
                    className={
                      savedMsgState.isError
                        ? 'text-xs text-danger whitespace-pre-line'
                        : 'text-xs text-success'
                    }
                  >
                    {savedMsgState.message}
                  </span>
                )}
                <Button variant="default" onClick={saveTemplate}>
                  💾 テンプレ保存
                </Button>
                <Button variant="primary" onClick={saveReport}>
                  💾 日報保存
                </Button>
                <Button variant="default" onClick={addProject}>
                  + 取引先追加
                </Button>
              </div>
            </div>
            {data.projects.map((proj, i) => (
              <ProjectBlock
                key={proj.id}
                project={proj}
                onChange={(p) => updateProject(i, p)}
                onRemove={() => removeProject(i)}
                canRemove={data.projects.length > 1}
              />
            ))}
            <ReflectionSection
              goodPoints={data.goodPoints}
              setGoodPoints={(v) => update('goodPoints', v)}
              badPoints={data.badPoints}
              setBadPoints={(v) => update('badPoints', v)}
              nextPlan={data.nextPlan}
              setNextPlan={(v) => update('nextPlan', v)}
            />
            <div className="flex gap-2 justify-center pt-4 border-t border-border">
              <Button
                variant="primary"
                onClick={() => setActiveTab('daily')}
                className="!px-7 !py-2.5 !text-sm"
              >
                📝 出力を確認 →
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'daily' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold mb-1">(1) 日報テキスト</h2>
              <p className="text-[13px] text-text-dim">フリーテキスト形式の作業報告</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex justify-end mb-2">
                <CopyButton text={dailyReport} />
              </div>
              <pre className="font-mono text-[13px] leading-[1.7] whitespace-pre-wrap break-all">
                {dailyReport || '(入力タブでデータを入力してください)'}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'project' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold mb-1">(2) プロジェクト別稼働報告</h2>
              <p className="text-[13px] text-text-dim">
                各プロジェクトのExcelセルに貼り付ける内容
              </p>
            </div>
            {projectSummaries.length === 0 && (
              <p className="text-text-dim text-sm">(入力タブでデータを入力してください)</p>
            )}
            {projectSummaries.map((sub, i) => (
              <div key={i} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="font-semibold text-[15px]">
                    <span className="text-accent">■</span> {sub.name}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label>時間セル（タブ区切り：作業開始 → 作業終了 → 休憩）</Label>
                      <CopyButton
                        text={`${sub.startTime}\t${sub.endTime}\t${sub.breakTime}`}
                      />
                    </div>
                    <CellRow
                      headers={['作業開始', '作業終了', '休憩']}
                      values={[sub.startTime, sub.endTime, sub.breakTime]}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label>作業内容セル</Label>
                      <CopyButton text={sub.content} />
                    </div>
                    <CellRow headers={['作業内容']} values={[sub.content]} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold mb-1">(3) 勤怠報告</h2>
              <p className="text-[13px] text-text-dim">会社に報告する始業/終業/休憩</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex justify-end mb-2">
                <CopyButton
                  text={`${data.startTime}\t${data.endTime}\t${data.breakTime}`}
                />
              </div>
              <CellRow
                headers={['始業', '終業', '休憩']}
                values={[data.startTime, data.endTime, data.breakTime]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
