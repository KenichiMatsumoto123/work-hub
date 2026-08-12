import { defineConfig, devices } from '@playwright/test'
import { E2E_USER } from './e2e/fixtures/e2e-user'

/**
 * E2E は「ログイン済み」を既定にする。
 * setup プロジェクトがテスト用ユーザーのセッションを発行し、その storageState を
 * chromium プロジェクトが読み込む（詳細は e2e/auth.setup.ts）。
 * 未ログインの挙動を見たいテストは test.use({ storageState: ... }) で個別に上書きする。
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: E2E_USER.storageState },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
