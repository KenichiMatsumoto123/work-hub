import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import './env'

// root `.env` は `./env` の import 時に process.env へロード済み
function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

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
