import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

/**
 * 実DBに接続する結合テスト用の設定（*.integration.test.ts）
 *
 * DB を必要とするため通常の `npm run test`（vitest.config.ts）からは除外し、
 * テスト用DBを起動したうえで `npm run test:integration` で実行する。
 * DB 接続は1本を共有するため、テスト同士の干渉を避けて直列実行にする。
 *
 * `setupFiles` は開発用 DB への接続拒否ガード（規定 10 のガードB）を
 * `report-db-helpers.ts` の import に依存せず全ファイルへ無条件適用するためのもの
 * （Phase 6 Round 3 FIND-LC-M01・Major）。ガードA（書き込み前の非空チェック）は
 * ファイル単位のスナップショットが前提のためここには移していない。新規の結合テストは
 * `report-db-helpers.ts` を経由すること（`AGENTS.md` を参照）。
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['./src/test/assert-not-dev-database-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
})
