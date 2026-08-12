import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

/**
 * 実DBに接続する結合テスト用の設定（*.integration.test.ts）
 *
 * DB を必要とするため通常の `npm run test`（vitest.config.ts）からは除外し、
 * テスト用DBを起動したうえで `npm run test:integration` で実行する。
 * DB 接続は1本を共有するため、テスト同士の干渉を避けて直列実行にする。
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
})
