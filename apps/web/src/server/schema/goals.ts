import { pgTable, uuid, varchar, text, date, timestamp, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/** 目標（中長期の大目的） */
export const goals = pgTable(
  'goals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    targetDate: date('target_date'),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'chk_goal_status',
      sql`${table.status} IN ('active', 'completed', 'archived')`,
    ),
  ],
)
