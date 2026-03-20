import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  numeric,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'

/** 日報（生成結果のキャッシュ） */
export const dailyReports = pgTable('daily_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: date('date').notNull().unique(),
  startTime: varchar('start_time', { length: 10 }).notNull(),
  endTime: varchar('end_time', { length: 10 }).notNull(),
  breakTime: varchar('break_time', { length: 10 }).notNull(),
  totalWorkHours: numeric('total_work_hours', { precision: 4, scale: 2 }),
  note: text('note'),
  goodPoints: text('good_points'),
  badPoints: text('bad_points'),
  nextPlan: text('next_plan'),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})
