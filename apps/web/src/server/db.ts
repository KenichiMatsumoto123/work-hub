import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
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

  // フォールバック（.env.example と docker-compose のデフォルトポートに合わせる）
  return 'postgres://workhub:workhub_dev@localhost:5432/workhub'
}

let dbInstance: PostgresJsDatabase<typeof schema> | null = null

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!dbInstance) {
    const client = postgres(loadDatabaseUrl(), {
      connect_timeout: 10,
      idle_timeout: 20,
      max: 10,
    })
    dbInstance = drizzle(client, { schema })
  }
  return dbInstance
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const real = getDb()
    const value = Reflect.get(real, prop, receiver)
    return typeof value === 'function' ? value.bind(real) : value
  },
})
