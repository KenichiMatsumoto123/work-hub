import { test, expect } from '@playwright/test'

test.describe('日報入力フロー', () => {
  test('日報入力画面が表示され、フォーム要素が存在する', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('input[type="date"]')

    // 日付入力が存在する
    await expect(page.locator('input[type="date"]')).toBeVisible()

    // 日報保存ボタンが存在する
    await expect(page.getByRole('button', { name: '💾 日報保存' })).toBeVisible()

    // テンプレ保存ボタンが存在する
    await expect(page.getByRole('button', { name: '💾 テンプレ保存' })).toBeVisible()
  })

  test('工数管理ページが読み込める', async ({ page }) => {
    await page.goto('/timesheet')
    // 月年の表示が存在する
    await expect(page.locator('text=月')).toBeVisible({ timeout: 10000 })
  })

  test('勤怠管理ページが読み込める', async ({ page }) => {
    await page.goto('/attendance')
    // 月タブが存在する
    await expect(page.getByRole('button', { name: '1月', exact: true })).toBeVisible({ timeout: 10000 })
  })
})
