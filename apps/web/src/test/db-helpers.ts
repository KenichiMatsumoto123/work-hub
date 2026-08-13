/**
 * DB込み結合テスト（*.integration.test.ts）用のヘルパー
 *
 * 【重要】このリポジトリには「全テーブルを空にする」API を意図的に置いていない。
 * 環境変数の解決は .env 一本に統一されており（src/server/env.ts の resolveDatabaseUrl が
 * 親ディレクトリを遡って .env を読む）、テストは開発用DBに接続する運用になっている。
 * ここで全テーブルを TRUNCATE すると開発中の日報データが消えるため、
 * 「テストが作ったデータだけを対象を絞って削除する」ことを既定の後始末とする
 * （実例: src/server/auth/auth.integration.test.ts）。
 *
 * どうしてもテーブルごと空にする必要がある場合だけ truncateTables() にテーブル名を
 * 明示列挙して呼ぶ。開発用DBと分けたい場合は DATABASE_URL を環境変数で上書きして実行する。
 */
import { sql } from 'drizzle-orm'
import { db } from '../server/db'

/** テストからも本体と同じ接続を使う（接続を増やさないため再エクスポートする） */
export const testDb = db

/** SQL識別子として安全なテーブル名か（英数字とアンダースコアのみ許可） */
const SAFE_TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * 指定したテーブルだけを TRUNCATE する。
 *
 * CASCADE は付けない。参照されているテーブルを消そうとすると Postgres 側がエラーにするため、
 * 呼び出し側は依存するテーブルも明示的に列挙することになる（暗黙の巻き添え削除を防ぐ）。
 *
 * @param tables 空にするテーブル名（1つ以上必須）
 */
export async function truncateTables(...tables: string[]): Promise<void> {
  if (tables.length === 0) {
    throw new Error(
      'truncateTables には空にするテーブル名を1つ以上渡してください（全テーブル削除は提供していません）',
    )
  }

  for (const table of tables) {
    if (!SAFE_TABLE_NAME.test(table)) {
      throw new Error(`テーブル名として扱えない文字列です: ${table}`)
    }
  }

  const targets = tables.map((table) => `"${table}"`).join(', ')
  await db.execute(sql.raw(`TRUNCATE TABLE ${targets} RESTART IDENTITY`))
}
