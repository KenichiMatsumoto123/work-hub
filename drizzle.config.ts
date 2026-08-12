import { defineConfig } from 'drizzle-kit'
import { resolveDatabaseUrl } from './apps/web/src/server/env'

export default defineConfig({
  schema: './apps/web/src/server/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // 環境変数が未設定でもリポジトリの .env を読む。アプリ本体と解決方法を揃えている。
    url: resolveDatabaseUrl(),
  },
})
