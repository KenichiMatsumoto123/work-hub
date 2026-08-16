import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import {
  parseTime,
  formatHours,
  formatDateShort,
  getDayName,
  getDatesInMonth,
  getToday,
} from './time-utils'

describe('parseTime', () => {
  it('HH:MM 形式を小数時間に変換する', () => {
    expect(parseTime('9:00')).toBe(9)
    expect(parseTime('9:30')).toBe(9.5)
    expect(parseTime('18:15')).toBe(18.25)
  })

  it('空文字列は0を返す', () => {
    expect(parseTime('')).toBe(0)
  })

  it('不正な値は0を返す', () => {
    expect(parseTime('abc')).toBe(0)
  })
})

describe('formatHours', () => {
  it('小数時間を HH:MM 形式に変換する', () => {
    expect(formatHours(9)).toBe('9:00')
    expect(formatHours(9.5)).toBe('9:30')
    expect(formatHours(1.25)).toBe('1:15')
  })

  it('0時間を正しくフォーマットする', () => {
    expect(formatHours(0)).toBe('0:00')
  })
})

describe('formatDateShort', () => {
  it('YYYY-MM-DD を M/D 形式に変換する', () => {
    expect(formatDateShort('2026-03-21')).toBe('3/21')
    expect(formatDateShort('2026-01-05')).toBe('1/5')
  })
})

describe('getDayName', () => {
  it('日付から曜日名を取得する', () => {
    // 2026-03-21 は土曜日
    expect(getDayName('2026-03-21')).toBe('土')
  })
})

describe('getDatesInMonth', () => {
  it('指定月の全日付を返す', () => {
    const dates = getDatesInMonth(2026, 3)
    expect(dates).toHaveLength(31)
    expect(dates[0]).toBe('2026-03-01')
    expect(dates[30]).toBe('2026-03-31')
  })

  it('2月（閏年でない）は28日', () => {
    const dates = getDatesInMonth(2026, 2)
    expect(dates).toHaveLength(28)
  })
})

describe('AC-L01〜L03 getToday（JST）', () => {
  it('AC-L01: JST 8/17 0:00 は 2026-08-17', () => {
    expect(getToday(new Date('2026-08-16T15:00:00.000Z'))).toBe('2026-08-17')
  })

  it('AC-L02: JST 8/16 23:59:59 は 2026-08-16', () => {
    expect(getToday(new Date('2026-08-16T14:59:59.000Z'))).toBe('2026-08-16')
    // UTC 実装の偶然一致を除外（L01 も同時に満たすこと）
    expect(getToday(new Date('2026-08-16T15:00:00.000Z'))).toBe('2026-08-17')
  })

  it('AC-L03: JST 8/16 9:00 は 2026-08-16', () => {
    expect(getToday(new Date('2026-08-16T00:00:00.000Z'))).toBe('2026-08-16')
    // UTC 実装の偶然一致を除外（L01 も同時に満たすこと）
    expect(getToday(new Date('2026-08-16T15:00:00.000Z'))).toBe('2026-08-17')
  })
})

describe('AC-L05 getToday 実装制約', () => {
  it('toISOString / getDate / getFullYear / getMonth を使わず Intl + Asia/Tokyo + formatToParts', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./time-utils.ts', import.meta.url)),
      'utf-8',
    )
    const fnBody = source.slice(source.indexOf('export function getToday'))
    expect(fnBody).toContain("timeZone: 'Asia/Tokyo'")
    expect(fnBody).toContain('formatToParts')
    expect(fnBody).not.toMatch(/\.toISOString\(/)
    expect(fnBody).not.toMatch(/\.getDate\(/)
    expect(fnBody).not.toMatch(/\.getFullYear\(/)
    expect(fnBody).not.toMatch(/\.getMonth\(/)
  })
})
