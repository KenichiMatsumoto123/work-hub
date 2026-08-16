import { test, expect, type Page } from '@playwright/test'

function dateInput(page: Page) {
  return page.locator('input[type="date"]')
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

test.describe('日報入力フロー', () => {
  test('日報入力画面が表示され、フォーム要素が存在する', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await waitForReportLoadSuccess(page)

    await expect(page.locator('input[type="date"]')).toBeVisible()

    await expect(page.getByRole('button', { name: '💾 日報保存' })).toBeVisible()

    await expect(page.getByRole('button', { name: '💾 テンプレ保存' })).toHaveCount(0)
  })

  test('工数管理ページが読み込める', async ({ page }) => {
    await page.goto('/timesheet')
    await expect(page.locator('text=月')).toBeVisible({ timeout: 10000 })
  })

  test('勤怠管理ページが読み込める', async ({ page }) => {
    await page.goto('/attendance')
    await expect(page.getByRole('button', { name: '1月', exact: true })).toBeVisible({ timeout: 10000 })
  })
})
