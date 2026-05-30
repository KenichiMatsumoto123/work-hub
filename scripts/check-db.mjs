import postgres from 'postgres'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const envPath = resolve(process.cwd(), '.env')
    const content = readFileSync(envPath, 'utf-8')
    const match = content.match(/DATABASE_URL=(.+)/)
    if (match) return match[1].trim()
  } catch {
    // ignore
  }
  return 'postgres://workhub:workhub_dev@localhost:5432/workhub'
}

const url = loadDatabaseUrl()
const parsed = new URL(url)
const sql = postgres(url, { connect_timeout: 5 })

try {
  await sql`select 1 as ok`
  console.log(`DB OK (${parsed.hostname}:${parsed.port || '5432'}/${parsed.pathname.slice(1)})`)
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`DB NG (${parsed.hostname}:${parsed.port || '5432'}): ${message || 'connection failed'}`)
  console.error('Hint: Docker Desktop を起動し、npm run db:up && npm run db:push を実行してください。')
  console.error('Hint: DATABASE_URL のポートと POSTGRES_HOST_PORT（docker-compose）が一致しているか確認してください。')
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 2 })
}
