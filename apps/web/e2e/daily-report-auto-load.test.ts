/**
 * 日報の自動読み込み：E2E（クリティカルパス）シナリオ E2E-L1〜L8
 *
 * 根拠：`docs/設計/日報の自動読み込み/_review/test/観点表.md` 2 章（凍結済み）。
 * 2.0 節の共通前提・2.1 節のセレクタ仕様・2.3 節のシナリオ仕様にそのまま従う。
 */
import { test, expect, type Browser, type Page } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { db } from '../src/server/db'
import { dailyReports, timeEntries } from '../src/server/schema'
import { E2E_USER } from './fixtures/e2e-user'

const DATE_CHANGE_CONFIRM = '入力内容が保存されていません。日付を切り替えますか？'
const LEAVE_PAGE_CONFIRM = '入力内容が保存されていません。このページを離れますか？'

const WARMUP_DATE = '2000-04-09'

const L1 = {
  date: '2000-04-01',
  startTime: '8:30',
  client: 'ITL-E2E-L1-取引先',
  project: 'ITL-E2E-L1-PJ',
  task: 'ITL-E2E-L1-タスク',
  hours: '2.5',
  goodPoints: 'ITL-E2E-L1-良かった点',
} as const

const L7 = {
  date: '2000-04-10',
  startTime: '8:00',
  client: 'ITL-E2E-L7-取引先',
  project: 'ITL-E2E-L7-PJ',
  task: 'ITL-E2E-L7-タスク',
  hours: '3.0',
  goodPoints: 'ITL-E2E-L7-良かった点',
} as const

async function cleanupSentinelDate(date: string): Promise<void> {
  await db.delete(timeEntries).where(eq(timeEntries.date, date))
  await db.delete(dailyReports).where(eq(dailyReports.date, date))
}

function dateInput(page: Page) {
  return page.locator('input[type="date"]')
}
function startTimeInput(page: Page) {
  return page
    .locator('span')
    .filter({ hasText: /^始業$/ })
    .locator('xpath=following-sibling::input[1]')
}
function clientNameInput(page: Page) {
  return page.getByPlaceholder('取引先', { exact: true })
}
function projectNameInput(page: Page) {
  return page.getByPlaceholder('プロジェクト', { exact: true })
}
function taskNameInput(page: Page) {
  return page.getByPlaceholder('タスク名', { exact: true })
}
function actualHoursInput(page: Page) {
  return page.getByPlaceholder('実績h', { exact: true })
}
function goodPointsInput(page: Page) {
  return page
    .locator('span')
    .filter({ hasText: '＜よかった点＞' })
    .locator('xpath=following-sibling::textarea[1]')
}
function saveButton(page: Page) {
  return page.getByRole('button', { name: /日報保存/ })
}
function savedMsg(page: Page) {
  return page.getByTestId('saved-msg')
}

const POLL_ATTEMPT_TIMEOUT_MS = 1000

async function readSavedMsgTextOnce(page: Page): Promise<string> {
  return (await savedMsg(page).textContent({ timeout: POLL_ATTEMPT_TIMEOUT_MS }).catch(() => '')) ?? ''
}

async function waitForMsgContains(
  page: Page,
  needle: string,
  opts: { intervalMs: number; timeoutMs: number },
): Promise<number> {
  const start = Date.now()
  for (;;) {
    const text = await readSavedMsgTextOnce(page)
    if (text.includes(needle)) return Date.now()
    if (Date.now() - start >= opts.timeoutMs) {
      throw new Error(`"${needle}" を含む saved-msg が ${opts.timeoutMs}ms 以内に現れなかった`)
    }
    await page.waitForTimeout(opts.intervalMs)
  }
}

async function waitForHydration(page: Page): Promise<void> {
  const toDaily = page.getByRole('button', { name: /📝 日報/ })
  const toInput = page.getByRole('button', { name: /✏️ 入力/ })

  await expect(async () => {
    await toDaily.click({ timeout: 2000 })
    await expect(page.getByText('(1) 日報テキスト')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 30000, intervals: [200, 500, 1000] })

  await toInput.click({ timeout: 2000 })
  await expect(dateInput(page)).toBeVisible()
}

async function waitForReportLoadSuccess(page: Page): Promise<void> {
  await expect(page.getByTestId('report-load-status')).toHaveCount(0, { timeout: 10000 })
}

/**
 * 日付変更後は loading バナーが出てから消える。
 * 出る前に count=0 を見ると、直前の ready を誤って成功完了とみなす。
 */
async function fillDateAndWaitLoad(page: Page, date: string): Promise<void> {
  await dateInput(page).fill(date)
  await expect(page.getByTestId('report-load-status')).toBeVisible({ timeout: 10000 })
  await waitForReportLoadSuccess(page)
}

async function freezePageDate(page: Page, isoOffset: string): Promise<void> {
  await page.addInitScript((iso: string) => {
    const frozenMs = Date.parse(iso)
    const NativeDate = Date
    const FakeDate = function (this: unknown, ...args: unknown[]) {
      const constructArgs = args.length === 0 ? [frozenMs] : args
      return Reflect.construct(NativeDate, constructArgs)
    }
    const FakeDateCtor = FakeDate as unknown as DateConstructor
    FakeDateCtor.now = () => frozenMs
    FakeDateCtor.parse = NativeDate.parse.bind(NativeDate)
    FakeDateCtor.UTC = NativeDate.UTC.bind(NativeDate)
    Object.setPrototypeOf(FakeDate, NativeDate)
    ;(globalThis as unknown as { Date: DateConstructor }).Date = FakeDateCtor
  }, isoOffset)
}

type SeedFields = {
  startTime: string
  client: string
  project: string
  task: string
  hours: string
  goodPoints: string
}

async function seedReportViaUi(
  browser: Browser,
  baseURL: string | undefined,
  date: string,
  fields: SeedFields,
): Promise<void> {
  const context = await browser.newContext({
    baseURL,
    storageState: E2E_USER.storageState,
  })
  const page = await context.newPage()
  try {
    await page.goto('/')
    await waitForHydration(page)
    await waitForReportLoadSuccess(page)
    await fillDateAndWaitLoad(page, date)
    await startTimeInput(page).fill(fields.startTime)
    await clientNameInput(page).first().fill(fields.client)
    await projectNameInput(page).first().fill(fields.project)
    await taskNameInput(page).first().fill(fields.task)
    await actualHoursInput(page).first().fill(fields.hours)
    await goodPointsInput(page).fill(fields.goodPoints)
    await saveButton(page).click()
    await waitForMsgContains(page, '保存しました', { intervalMs: 200, timeoutMs: 80000 })
  } finally {
    await context.close()
  }
}

test.beforeAll(async ({ browser, baseURL }, testInfo) => {
  testInfo.setTimeout(90000)

  const context = await browser.newContext({ baseURL, storageState: E2E_USER.storageState })
  const page = await context.newPage()
  try {
    await page.goto('/')
    await waitForHydration(page)
    await waitForReportLoadSuccess(page)
    await fillDateAndWaitLoad(page, WARMUP_DATE)
  } finally {
    await context.close()
  }
})

test.afterAll(async () => {
  await cleanupSentinelDate(WARMUP_DATE)
})

test.describe('E2E-L1 日付変更で保存済み日報がある', () => {
  test.afterEach(async () => {
    await cleanupSentinelDate(L1.date)
  })

  test('日付を切り替えると保存済みの始業・取引先・実績h・良かった点が載る', async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120000)
    await seedReportViaUi(browser, baseURL, L1.date, L1)

    await page.goto('/')
    await waitForHydration(page)
    await waitForReportLoadSuccess(page)
    await fillDateAndWaitLoad(page, L1.date)

    await expect(dateInput(page)).toHaveValue(L1.date)
    await expect(startTimeInput(page)).toHaveValue(L1.startTime)
    await expect(clientNameInput(page).first()).toHaveValue(L1.client)
    await expect(actualHoursInput(page).first()).toHaveValue(L1.hours)
    await expect(goodPointsInput(page)).toHaveValue(L1.goodPoints)
  })
})

test.describe('E2E-L2 日付変更で保存済み日報がない', () => {
  const date = '2000-04-02'

  test.afterEach(async () => {
    await cleanupSentinelDate(date)
  })

  test('行が無い日付へ切り替えると空の初期値が載る', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await waitForReportLoadSuccess(page)
    await fillDateAndWaitLoad(page, date)

    await expect(dateInput(page)).toHaveValue(date)
    await expect(startTimeInput(page)).toHaveValue('9:00')
    await expect(clientNameInput(page).first()).toHaveValue('')
    await expect(actualHoursInput(page).first()).toHaveValue('')
    await expect(goodPointsInput(page)).toHaveValue('')
  })
})

test.describe('E2E-L3 画面オープン時の今日日付', () => {
  test('日付欄が日本時間の今日と一致する', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await waitForReportLoadSuccess(page)

    const expected = await page.evaluate(() => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date())
      const year = parts.find((p) => p.type === 'year')!.value
      const month = parts.find((p) => p.type === 'month')!.value.padStart(2, '0')
      const day = parts.find((p) => p.type === 'day')!.value.padStart(2, '0')
      return `${year}-${month}-${day}`
    })

    await expect(dateInput(page)).toHaveValue(expected)
  })
})

test.describe('E2E-L4 テンプレ保存の廃止', () => {
  test('テンプレ保存ボタンは無く日報保存はある', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await waitForReportLoadSuccess(page)

    await expect(page.getByRole('button', { name: '💾 テンプレ保存' })).toHaveCount(0)
    await expect(saveButton(page)).toBeVisible()
  })
})

test.describe('E2E-L5 日付変更 confirm をキャンセルする', () => {
  const fromDate = '2000-04-11'
  const toDate = '2000-04-12'

  test.afterEach(async () => {
    await cleanupSentinelDate(fromDate)
    await cleanupSentinelDate(toDate)
  })

  test('キャンセルすると日付も取引先も変わらない', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await waitForReportLoadSuccess(page)
    await fillDateAndWaitLoad(page, fromDate)
    await clientNameInput(page).first().fill('x')

    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      dateInput(page).fill(toDate),
    ])
    expect(dialog.message()).toBe(DATE_CHANGE_CONFIRM)
    await dialog.dismiss()

    await expect(dateInput(page)).toHaveValue(fromDate)
    await expect(clientNameInput(page).first()).toHaveValue('x')
  })
})

test.describe('E2E-L6 工数管理への未保存 confirm をキャンセルする', () => {
  const date = '2000-04-11'

  test.afterEach(async () => {
    await cleanupSentinelDate(date)
  })

  test('キャンセルすると URL も入力も変わらない', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await waitForReportLoadSuccess(page)
    await fillDateAndWaitLoad(page, date)
    await clientNameInput(page).first().fill('x')

    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.getByRole('link', { name: '工数管理' }).click(),
    ])
    expect(dialog.message()).toBe(LEAVE_PAGE_CONFIRM)
    await dialog.dismiss()

    await expect(page).toHaveURL(/\/$/)
    await expect(dateInput(page)).toHaveValue(date)
    await expect(clientNameInput(page).first()).toHaveValue('x')
  })
})

test.describe('E2E-L6b 勤怠管理への未保存 confirm をキャンセルする', () => {
  const date = '2000-04-11'

  test.afterEach(async () => {
    await cleanupSentinelDate(date)
  })

  test('キャンセルすると URL も入力も変わらない', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await waitForReportLoadSuccess(page)
    await fillDateAndWaitLoad(page, date)
    await clientNameInput(page).first().fill('x')

    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.getByRole('link', { name: '勤怠管理' }).click(),
    ])
    expect(dialog.message()).toBe(LEAVE_PAGE_CONFIRM)
    await dialog.dismiss()

    await expect(page).toHaveURL(/\/$/)
    await expect(dateInput(page)).toHaveValue(date)
    await expect(clientNameInput(page).first()).toHaveValue('x')
  })
})

test.describe('E2E-L7 画面オープン時に保存済み日報がある', () => {
  test.afterEach(async () => {
    await cleanupSentinelDate(L7.date)
  })

  test('今日が保存済み日付なら開いた時点でその内容が載る', async ({ page, browser, baseURL }) => {
    test.setTimeout(120000)
    await seedReportViaUi(browser, baseURL, L7.date, L7)

    await freezePageDate(page, '2000-04-10T00:00:00+09:00')
    await page.goto('/')
    await waitForHydration(page)
    await waitForReportLoadSuccess(page)

    await expect(dateInput(page)).toHaveValue(L7.date)
    await expect(startTimeInput(page)).toHaveValue(L7.startTime)
    await expect(clientNameInput(page).first()).toHaveValue(L7.client)
    await expect(actualHoursInput(page).first()).toHaveValue(L7.hours)
    await expect(goodPointsInput(page)).toHaveValue(L7.goodPoints)
  })
})

test.describe('E2E-L8 画面オープン時に保存済み日報がない', () => {
  const date = '2000-04-03'

  test.afterEach(async () => {
    await cleanupSentinelDate(date)
  })

  test('今日に行が無ければ空の初期値が載る', async ({ page }) => {
    await freezePageDate(page, '2000-04-03T00:00:00+09:00')
    await page.goto('/')
    await waitForHydration(page)
    await waitForReportLoadSuccess(page)

    await expect(dateInput(page)).toHaveValue(date)
    await expect(startTimeInput(page)).toHaveValue('9:00')
    await expect(clientNameInput(page).first()).toHaveValue('')
    await expect(actualHoursInput(page).first()).toHaveValue('')
    await expect(goodPointsInput(page)).toHaveValue('')
  })
})
