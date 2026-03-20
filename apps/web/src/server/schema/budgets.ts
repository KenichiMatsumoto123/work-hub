import {
  pgTable,
  uuid,
  integer,
  numeric,
  timestamp,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clients, projects } from './master'

/** 月間工数予算（クライアント×プロジェクト×月） */
export const effortBudgets = pgTable(
  'effort_budgets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id').references(() => clients.id),
    projectId: uuid('project_id').references(() => projects.id),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    budgetHours: numeric('budget_hours', { precision: 6, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('effort_budgets_unique_idx').on(
      table.clientId,
      table.projectId,
      table.year,
      table.month,
    ),
    check('chk_budget_positive', sql`${table.budgetHours} >= 0`),
    check('chk_month_range', sql`${table.month} BETWEEN 1 AND 12`),
  ],
)

/** 週次工数予算 */
export const weeklyEffortBudgets = pgTable(
  'weekly_effort_budgets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id').references(() => clients.id),
    projectId: uuid('project_id').references(() => projects.id),
    year: integer('year').notNull(),
    weekNumber: integer('week_number').notNull(),
    budgetHours: numeric('budget_hours', { precision: 6, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('weekly_effort_budgets_unique_idx').on(
      table.clientId,
      table.projectId,
      table.year,
      table.weekNumber,
    ),
    check(
      'chk_weekly_budget_positive',
      sql`${table.budgetHours} >= 0`,
    ),
    check(
      'chk_week_number_range',
      sql`${table.weekNumber} BETWEEN 1 AND 53`,
    ),
  ],
)
