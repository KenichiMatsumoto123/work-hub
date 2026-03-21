import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// .env ファイルから DATABASE_URL を読み込み（dotenv不要）
function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  try {
    const envPath = resolve(process.cwd(), '../../.env')
    const content = readFileSync(envPath, 'utf-8')
    const match = content.match(/DATABASE_URL=(.+)/)
    if (match) return match[1].trim()
  } catch {
    // ignore
  }

  // フォールバック
  return 'postgres://workhub:workhub_dev@localhost:5432/workhub'
}

const client = postgres(loadDatabaseUrl())
export const db = drizzle(client, { schema })
