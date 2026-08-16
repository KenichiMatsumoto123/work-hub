import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  unique,
} from 'drizzle-orm/pg-core'

/** 取引先マスタ */
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }),
    sortOrder: integer('sort_order').default(0).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('clients_code_idx').on(table.code),
    // S-1: 取引先名の重複作成を防ぐ（設計書「スキーマ変更一覧」）
    unique('clients_name_unique').on(table.name),
  ],
)

/** プロジェクトマスタ（取引先に紐付き） */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .references(() => clients.id)
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }),
    sortOrder: integer('sort_order').default(0).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('projects_code_idx').on(table.code),
    // S-2: 同一取引先内でのプロジェクト名の重複作成を防ぐ（取引先が違えば同名を許す。AC-19）
    unique('projects_client_name_unique').on(table.clientId, table.name),
  ],
)

/** タスクカテゴリマスタ */
export const taskCategories = pgTable('task_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  color: varchar('color', { length: 7 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

/** 技術タグマスタ */
export const technologyTags = pgTable('technology_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})
