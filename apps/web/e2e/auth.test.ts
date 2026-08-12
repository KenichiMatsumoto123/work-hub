import { test, expect, request as apiRequest } from '@playwright/test'
import { E2E_LOGOUT_USER, E2E_USER } from './fixtures/e2e-user'

/**
 * 日報データを扱うサーバ関数（src/server/functions/reports.ts）へのリクエストか判定する。
 * サーバ関数のURLは `/_serverFn/<定義元をbase64したid>` の形になっている。
 */
function isReportsServerFn(url: string): boolean {
  const id = url.split('/_serverFn/')[1]?.split('?')[0]
  if (!id) return false
  try {
    return Buffer.from(decodeURIComponent(id), 'base64')
      .toString('utf-8')
      .includes('functions/reports')
  } catch {
    return false
  }
}

test.describe('未ログイン', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('保護ページを開くとログイン画面へリダイレクトされる', async ({ page }) => {
    await page.goto('/timesheet')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByTestId('login-google')).toBeVisible()
    // グローバルナビは出さない（ログイン後の画面と取り違えないため）
    await expect(page.getByTestId('global-nav')).toHaveCount(0)
  })

  test('ログイン画面には元のページへの戻り先が保持される', async ({ page }) => {
    await page.goto('/attendance')

    await expect(page).toHaveURL(/redirect=%2Fattendance/)
  })

  test('ログイン拒否の理由が表示される', async ({ page }) => {
    await page.goto('/login?error=email_not_allowed')

    await expect(page.getByTestId('login-error')).toBeVisible()
  })
})

test.describe('ログイン済み', () => {
  test('保護ページを開ける', async ({ page }) => {
    await page.goto('/')

    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByTestId('global-nav')).toBeVisible()
    await expect(page.getByTestId('session-email')).toHaveText(E2E_USER.email)
  })

  test('データ取得のサーバ関数はログインしていないと401を返す', async ({
    page,
    baseURL,
  }) => {
    // 画面はリダイレクトで守られるが、サーバ関数は直接叩けるため個別に確認する。
    // ログイン済みの画面から実際に呼ばれる URL を拾い、同じ URL をクッキー無しで叩く。
    // セッション取得のサーバ関数は未ログインでも 200（null）を返すので、日報データの方を選ぶ。
    const serverFnRequest = page.waitForRequest((request) =>
      isReportsServerFn(request.url()),
    )
    await page.goto('/timesheet')
    const url = (await serverFnRequest).url()

    // newContext はテストの storageState を引き継ぐため、明示的に空にする
    const anonymous = await apiRequest.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    })
    try {
      const response = await anonymous.get(url)
      expect(response.status()).toBe(401)
    } finally {
      await anonymous.dispose()
    }
  })
})

// ログアウトはセッションを失効させるため、他のテストと共有しない専用ユーザーで実施する
test.describe('ログアウト', () => {
  test.use({ storageState: E2E_LOGOUT_USER.storageState })

  test('ログイン画面に戻り、保護ページに入れなくなる', async ({ page }) => {
    await page.goto('/')

    // SSR 直後はまだハイドレーションが終わっておらず、クリックが反応しないことがある。
    // 実際の利用でも押し直すだけなので、遷移するまでクリックを繰り返す。
    await expect(async () => {
      await page.getByTestId('logout').click()
      await expect(page).toHaveURL(/\/login/, { timeout: 2_000 })
    }).toPass({ timeout: 20_000 })

    await page.goto('/timesheet')
    await expect(page).toHaveURL(/\/login/)
  })
})
