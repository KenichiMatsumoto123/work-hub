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
const maxAttempts = 30

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const sql = postgres(url, { connect_timeout: 2 })
  try {
    await sql`select 1 as ok`
    console.log(`PostgreSQL ready (attempt ${attempt})`)
    await sql.end({ timeout: 2 })
    process.exit(0)
  } catch {
    await sql.end({ timeout: 2 }).catch(() => {})
    await new Promise((r) => setTimeout(r, 1000))
  }
}

console.error('PostgreSQL did not become ready in time')
process.exit(1)
