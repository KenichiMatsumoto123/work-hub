import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', '!src/**/*.integration.test.{ts,tsx}'],
    exclude: ['node_modules/**'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // カバレッジ計測対象は導入先のディレクトリ構成に合わせて調整する
      // （テストを整備済みの範囲だけを列挙し、閾値の適用対象を明確にする運用を推奨）
      include: ['src/app/_utils/**/*.ts', 'src/app/api/**/*.ts'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**', 'src/**/fixtures/**'],
      // カバレッジ数値は成果指標とせず、
      // 「該当ファイルにテストが1件もない／極端に手薄」を機械的に検出する安全網としてのみ運用する。
      // 閾値は導入先の実測値に余裕を持たせて設定し、段階的に引き上げる。
      thresholds: {
        perFile: true,
        lines: 50,
        statements: 50,
        functions: 50,
        branches: 35,
      },
    },
  },
});
