import postgres from 'postgres'

const port = process.argv[2] || '5432'
const url = `postgres://workhub:workhub_dev@localhost:${port}/workhub`
const sql = postgres(url)
try {
  const r = await sql`select 1 as x`
  console.log(`port ${port}: OK`, r)
} catch (e) {
  console.error(`port ${port}: FAIL`, e.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 2 })
}
