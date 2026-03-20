import { test, expect } from '@playwright/test'

test('トップページが正常に表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/日報・工数管理システム/)
})

test('ナビゲーションリンクが存在する', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: '日報入力' })).toBeVisible()
  await expect(page.getByRole('link', { name: '工数管理' })).toBeVisible()
  await expect(page.getByRole('link', { name: '勤怠管理' })).toBeVisible()
})

test('工数管理ページに遷移できる', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: '工数管理' }).click()
  await expect(page).toHaveURL(/\/timesheet/)
})

test('勤怠管理ページに遷移できる', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: '勤怠管理' }).click()
  await expect(page).toHaveURL(/\/attendance/)
})
