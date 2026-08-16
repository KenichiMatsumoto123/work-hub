import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 実DBを必要とする結合テストは npm run test:integration で別に実行する
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.integration.test.ts'],
    setupFiles: ['./src/test/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      // テストを整備済みの範囲に限定する。対象を広げるときはここに追記する
      // （画面コンポーネントは対象外。ロジックを lib/server 側へ分離してテストする方針）
      include: ['src/lib/**/*.ts', 'src/server/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.integration.test.ts', 'src/server/schema/**'],
    },
  },
})
