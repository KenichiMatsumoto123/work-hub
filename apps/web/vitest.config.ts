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
    setupFiles: [],
  },
})
