import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { resolveDatabaseUrl } from './env'

let dbInstance: PostgresJsDatabase<typeof schema> | null = null

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!dbInstance) {
    const client = postgres(resolveDatabaseUrl(), {
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
