/**
 * createServerFn の未変換クライアント経路は handler 戻り値を ctx と誤解釈し result が undefined になる。
 * getReportByDateFn だけ fetchReportByDate を直接呼ぶラッパに差し替える（AC-L12 / AC-L10 / AC-L11）。
 */
import { vi } from 'vitest'

vi.mock('../server/functions/reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/functions/reports')>()
  const { fetchReportByDate } = await import('../server/functions/fetch-report-by-date')
  const base = actual.getReportByDateFn
  return {
    ...actual,
    getReportByDateFn: Object.assign(
      async (opts: { data: { date: string } }) =>
        fetchReportByDate(opts.data.date),
      base,
    ),
  }
})
