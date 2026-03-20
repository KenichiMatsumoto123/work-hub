import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './apps/web/src/server/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
