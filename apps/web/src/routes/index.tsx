import { createFileRoute, useBlocker } from '@tanstack/react-router'
import { useRef, useState, useEffect, useCallback } from 'react'
import { Input } from '~/components/ui/Input'
import { Button } from '~/components/ui/Button'
import { Label } from '~/components/ui/Label'
import { CopyButton } from '~/components/ui/CopyButton'
import { CellRow } from '~/components/ui/CellRow'
import { ProjectBlock } from '~/components/report/ProjectBlock'
import { ReflectionSection } from '~/components/report/ReflectionSection'
import { defaultProject } from '~/lib/defaults'
import { generateDailyReport, getProjectSummary } from '~/lib/report-generator'
import { getToday } from '~/lib/time-utils'
import { reportStorage } from '~/lib/storage'
import {
  savedMsgReducer,
  runSavedMsgEffects,
  initialSavedMsgState,
  type SavedMsgEvent,
} from '~/lib/saved-msg'
import {
  emptyReport,
  getFormControlsAccessibility,
  isReportDirty,
  LEAVE_PAGE_CONFIRM,
  LOAD_STATUS_ERROR,
  LOAD_STATUS_LOADING,
  markReportSaved,
  onDateChange,
  shouldConfirmSpaLeave,
  shouldFetchReport,
  shouldPreventUnload,
  startLoad,
  type ReportLoadState,
} from '~/lib/report-load'
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
  disabled,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border-none rounded-lg cursor-pointer font-sans px-5 py-2.5 text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
        active ? 'bg-accent text-white font-semibold' : 'bg-transparent text-text-dim font-normal'
      }`}
    >
      {children}
    </button>
  )
}

function createInitialLoadState(): ReportLoadState {
  const initial = emptyReport(getToday())
  return {
    data: initial,
    baseline: initial,
    loadStatus: 'loading',
    loadRequestId: 0,
  }
}

function HomePage() {
  const [loadState, setLoadState] = useState<ReportLoadState>(createInitialLoadState)
  const { data, baseline, loadStatus } = loadState
  const [activeTab, setActiveTab] = useState<TabId>('input')

  const savedMsgStateRef = useRef(initialSavedMsgState)
  const [savedMsgState, setSavedMsgState] = useState(initialSavedMsgState)

  const loadDeps = useCallback(
    () => ({
      getByDate: reportStorage.getByDate,
      assignLocation: (href: string) => window.location.assign(href),
    }),
    [],
  )

  const runLoad = useCallback(
    (state: ReportLoadState, date: string) => {
      const requestId = state.loadRequestId + 1
      const optimistic: ReportLoadState = {
        ...state,
        loadRequestId: requestId,
        loadStatus: 'loading',
        data: shouldFetchReport(date) ? { ...state.data, date } : state.data,
      }
      setLoadState(optimistic)
      startLoad(state, date, loadDeps()).then(setLoadState)
    },
    [loadDeps],
  )

  useEffect(() => {
    const today = getToday()
    const initial = emptyReport(today)
    const state: ReportLoadState = {
      data: initial,
      baseline: initial,
      loadStatus: 'loading',
      loadRequestId: 0,
    }
    startLoad(state, today, loadDeps()).then(setLoadState)
  }, [loadDeps])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (shouldPreventUnload(isReportDirty(data, baseline), loadStatus)) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [data, baseline, loadStatus])

  useBlocker({
    shouldBlockFn: ({ next }) => {
      if (next.pathname !== '/timesheet' && next.pathname !== '/attendance') {
        return false
      }
      if (!shouldConfirmSpaLeave(isReportDirty(data, baseline), loadStatus)) {
        return false
      }
      return !window.confirm(LEAVE_PAGE_CONFIRM)
    },
    enableBeforeUnload: false,
  })

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
    setLoadState((prev) => ({ ...prev, data: { ...prev.data, [field]: val } }))

  const handleDateChange = (nextDate: string) => {
    const change = onDateChange(loadState, nextDate, {
      confirm: (message) => window.confirm(message),
    })
    if (change.action === 'startLoad') {
      runLoad(change.state, change.date)
    }
  }

  const handleRetry = () => {
    runLoad(loadState, loadState.data.date)
  }

  const saveReport = async () => {
    if (!data.date) {
      sendSavedMsgEvent({ type: 'dateMissing' })
      return
    }
    const result = await reportStorage.save(data)
    if (result.ok) {
      setLoadState((prev) => markReportSaved(prev))
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
      data.projects.filter((_, i) => i !== idx),
    )
  const addProject = () => update('projects', [...data.projects, defaultProject()])

  const { dateEnabled, retryEnabled, formLocked } = getFormControlsAccessibility(loadStatus)

  const dailyReport = generateDailyReport(data)
  const totalPlanned = data.projects.reduce(
    (s, p) => s + p.tasks.reduce((ss, t) => ss + (parseFloat(t.plannedHours) || 0), 0),
    0,
  )
  const totalActual = data.projects.reduce(
    (s, p) => s + p.tasks.reduce((ss, t) => ss + (parseFloat(t.actualHours) || 0), 0),
    0,
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
            disabled={!dateEnabled}
            onChange={(e) => handleDateChange(e.target.value)}
            className="!w-[150px]"
          />
          <div className="flex items-center gap-1.5 bg-bg rounded-md px-2.5 py-1 border border-border">
            <Label>始業</Label>
            <Input
              value={data.startTime}
              disabled={formLocked}
              onChange={(e) => update('startTime', e.target.value)}
              className="!w-[60px] !border-none !p-1"
            />
            <Label>終業</Label>
            <Input
              value={data.endTime}
              disabled={formLocked}
              onChange={(e) => update('endTime', e.target.value)}
              className="!w-[60px] !border-none !p-1"
            />
            <Label>休憩</Label>
            <Input
              value={data.breakTime}
              disabled={formLocked}
              onChange={(e) => update('breakTime', e.target.value)}
              className="!w-[60px] !border-none !p-1"
            />
          </div>
          <div className="bg-tag rounded-md px-3 py-1.5 text-[13px] font-semibold font-mono">
            合計: {totalPlanned}h → {totalActual}h
          </div>
        </div>
      </div>

      {/* Load status banner */}
      {loadStatus !== 'ready' && (
        <div className="bg-surface border-b border-border px-6 py-2 flex items-center gap-3">
          <span data-testid="report-load-status">
            {loadStatus === 'loading' ? LOAD_STATUS_LOADING : LOAD_STATUS_ERROR}
          </span>
          {retryEnabled && (
            <Button
              variant="default"
              data-testid="report-load-retry"
              onClick={handleRetry}
            >
              再試行
            </Button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface px-4 gap-1">
        <TabButton active={activeTab === 'input'} onClick={() => setActiveTab('input')}>
          ✏️ 入力
        </TabButton>
        <TabButton
          active={activeTab === 'daily'}
          disabled={formLocked}
          onClick={() => setActiveTab('daily')}
        >
          📝 日報
        </TabButton>
        <TabButton
          active={activeTab === 'project'}
          disabled={formLocked}
          onClick={() => setActiveTab('project')}
        >
          📊 PJ稼働
        </TabButton>
        <TabButton
          active={activeTab === 'attendance'}
          disabled={formLocked}
          onClick={() => setActiveTab('attendance')}
        >
          🕐 勤怠
        </TabButton>
      </div>

      {/* Content */}
      <div className="px-6 py-5 max-w-[960px] mx-auto">
        {activeTab === 'input' && (
          <fieldset disabled={formLocked} className="flex flex-col gap-4 border-none p-0 m-0 min-w-0">
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
                disabled={formLocked}
                onClick={() => setActiveTab('daily')}
                className="!px-7 !py-2.5 !text-sm"
              >
                📝 出力を確認 →
              </Button>
            </div>
          </fieldset>
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
