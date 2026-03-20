import { describe, it, expect } from 'vitest'
import {
  generateDailyReport,
  getProjectSummary,
  getAttendanceData,
} from './report-generator'
import type { DailyReportData, Project } from './types'

function createTestData(overrides?: Partial<DailyReportData>): DailyReportData {
  return {
    date: '2026-03-21',
    startTime: '9:00',
    endTime: '18:00',
    breakTime: '1:00',
    note: '',
    projects: [
      {
        id: 'p1',
        name: 'Hexabase',
        plannedHours: '',
        tasks: [
          {
            id: 't1',
            label: 'HNC',
            name: 'API設計',
            plannedHours: '4',
            actualHours: '5',
            progressBefore: '0',
            progressExpected: '50',
            progressActual: '40',
          },
        ],
      },
    ],
    goodPoints: '順調に進んだ',
    badPoints: '見積もりが甘かった',
    nextPlan: 'テスト実装',
    ...overrides,
  }
}

describe('generateDailyReport', () => {
  it('日報テキストを正しく生成する', () => {
    const data = createTestData()
    const report = generateDailyReport(data)

    expect(report).toContain('＜3/21 作業報告＞')
    expect(report).toContain('■Hexabase（4h → 5h）')
    expect(report).toContain('【HNC】API設計')
    expect(report).toContain('＜よかった点＞')
    expect(report).toContain('順調に進んだ')
    expect(report).toContain('＜課題点＞')
    expect(report).toContain('見積もりが甘かった')
    expect(report).toContain('＜次回の稼働予定＞')
    expect(report).toContain('テスト実装')
  })

  it('プロジェクト名が空の場合はスキップする', () => {
    const data = createTestData({
      projects: [
        { id: 'p1', name: '', plannedHours: '', tasks: [] },
      ],
      goodPoints: '',
      badPoints: '',
      nextPlan: '',
    })
    const report = generateDailyReport(data)
    expect(report).toBe('＜3/21 作業報告＞')
  })

  it('振り返りが空の場合はセクションを省略する', () => {
    const data = createTestData({
      goodPoints: '',
      badPoints: '',
      nextPlan: '',
    })
    const report = generateDailyReport(data)
    expect(report).not.toContain('＜よかった点＞')
    expect(report).not.toContain('＜課題点＞')
    expect(report).not.toContain('＜次回の稼働予定＞')
  })
})

describe('getProjectSummary', () => {
  it('プロジェクトの工数サマリーを計算する', () => {
    const proj: Project = {
      id: 'p1',
      name: 'Hexabase',
      plannedHours: '',
      tasks: [
        {
          id: 't1',
          label: 'HNC',
          name: 'API設計',
          plannedHours: '4',
          actualHours: '5',
          progressBefore: '0',
          progressExpected: '50',
          progressActual: '40',
        },
        {
          id: 't2',
          label: '',
          name: 'レビュー',
          plannedHours: '1',
          actualHours: '1',
          progressBefore: '0',
          progressExpected: '100',
          progressActual: '100',
        },
      ],
    }
    const summary = getProjectSummary(proj)

    expect(summary.name).toBe('Hexabase')
    expect(summary.totalActual).toBe(6)
    expect(summary.workTime).toBe('6:00')
    expect(summary.content).toContain('HNC：API設計')
    expect(summary.content).toContain('レビュー')
  })
})

describe('getAttendanceData', () => {
  it('勤怠データを返す', () => {
    const data = createTestData()
    const attendance = getAttendanceData(data)

    expect(attendance.startTime).toBe('9:00')
    expect(attendance.endTime).toBe('18:00')
    expect(attendance.breakTime).toBe('1:00')
  })
})
