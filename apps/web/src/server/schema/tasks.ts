import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  date,
  timestamp,
  index,
  check,
  unique,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clients, projects, taskCategories, technologyTags } from './master'
import { goals } from './goals'

/** タスク */
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: varchar('type', { length: 20 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    priority: varchar('priority', { length: 10 }).default('medium').notNull(),
    // リレーション（全て nullable — adhoc タスクはゴール/PJ不要）
    goalId: uuid('goal_id').references(() => goals.id),
    clientId: uuid('client_id').references(() => clients.id),
    projectId: uuid('project_id').references(() => projects.id),
    categoryId: uuid('category_id').references(() => taskCategories.id),
    parentTaskId: uuid('parent_task_id'),
    // 見積もり・実績（AI見積もりアシスト用）
    estimatedHours: numeric('estimated_hours', { precision: 6, scale: 2 }),
    actualHours: numeric('actual_hours', { precision: 6, scale: 2 }),
    complexity: varchar('complexity', { length: 10 }),
    dueDate: date('due_date'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('tasks_project_idx').on(table.projectId),
    index('tasks_goal_idx').on(table.goalId),
    index('tasks_type_status_idx').on(table.type, table.status),
    check(
      'chk_task_type',
      sql`${table.type} IN ('project', 'adhoc', 'routine')`,
    ),
    check(
      'chk_task_status',
      sql`${table.status} IN ('active', 'completed', 'archived')`,
    ),
    check(
      'chk_task_priority',
      sql`${table.priority} IN ('low', 'medium', 'high', 'urgent')`,
    ),
    check(
      'chk_task_complexity',
      sql`${table.complexity} IS NULL OR ${table.complexity} IN ('small', 'medium', 'large')`,
    ),
    // project タスクは projectId 必須、adhoc/routine は不要
    check(
      'chk_task_type_project',
      sql`${table.type} != 'project' OR ${table.projectId} IS NOT NULL`,
    ),
    // S-3: タスクの名寄せキーの重複作成を防ぐ。project_id / client_id が
    // ともに NULL の adhoc タスク（AC-23・AC-25）も重複と判定させるため
    // NULLS NOT DISTINCT を使う（設計書「スキーマ変更一覧」）
    unique('tasks_pj_cl_title_unique')
      .on(table.projectId, table.clientId, table.title)
      .nullsNotDistinct(),
  ],
)

/** タスク × 技術タグ（中間テーブル） */
export const taskTechnologyTags = pgTable(
  'task_technology_tags',
  {
    taskId: uuid('task_id')
      .references(() => tasks.id, { onDelete: 'cascade' })
      .notNull(),
    tagId: uuid('tag_id')
      .references(() => technologyTags.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [index('task_tags_task_idx').on(table.taskId)],
)

/** 工数記録（実績の唯一のマスター） */
export const timeEntries = pgTable(
  'time_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .references(() => tasks.id)
      .notNull(),
    date: date('date').notNull(),
    hours: numeric('hours', { precision: 4, scale: 2 }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('time_entries_date_idx').on(table.date),
    index('time_entries_task_idx').on(table.taskId),
    index('time_entries_task_date_idx').on(table.taskId, table.date),
    check('chk_hours_non_negative', sql`${table.hours} >= 0`),
  ],
)

/** 予定工数（スケジュール） */
export const scheduleEntries = pgTable(
  'schedule_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .references(() => tasks.id)
      .notNull(),
    date: date('date').notNull(),
    plannedHours: numeric('planned_hours', { precision: 4, scale: 2 }).notNull(),
    isCancelled: boolean('is_cancelled').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('schedule_entries_date_idx').on(table.date),
    index('schedule_entries_task_date_idx').on(table.taskId, table.date),
    check(
      'chk_planned_hours_positive',
      sql`${table.plannedHours} > 0`,
    ),
  ],
)
