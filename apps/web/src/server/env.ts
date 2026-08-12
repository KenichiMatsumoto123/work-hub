/**
 * .env の読み込みと DATABASE_URL の解決
 *
 * 起動方法によって process.cwd() が変わる（npm run start ならリポジトリ直下、
 * `pm2 start apps/web/serve.mjs` なら pm2 を実行したディレクトリ）ため、
 * 固定の相対パスではなく親ディレクトリを遡って .env を探す。
 *
 * .env のパース自体は dotenv の parse に任せる（ファイル探索や process.env への
 * 注入はしない純粋な関数のため、探索処理と組み合わせて使える）。
 */
import { existsSync, readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { parse as parseEnv } from 'dotenv'

/** .env が無い場合の開発用フォールバック（.env.example と docker-compose に合わせる） */
export const DEV_FALLBACK_DATABASE_URL =
  'postgres://workhub:workhub_dev@localhost:5432/workhub'

/** startDir から上位ディレクトリへ遡り、最初に見つかった .env のパスを返す */
export function findEnvFile(startDir: string): string | null {
  let dir = resolve(startDir)

  for (;;) {
    const candidate = join(dir, '.env')
    if (existsSync(candidate)) return candidate

    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * DATABASE_URL を解決する。
 * 環境変数 → 親ディレクトリを遡って見つけた .env → 開発用フォールバック の順。
 *
 * 本番（NODE_ENV=production）では開発用フォールバックを使わず例外を投げる。
 * 誤った認証情報で接続を試みると「password authentication failed」という
 * 原因の分かりにくいエラーになるため、設定不足の時点で失敗させる。
 */
export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  if (env.DATABASE_URL) return env.DATABASE_URL

  // cwd 起点で見つからない場合に備え、サーバー起動スクリプトが渡すアプリ配置先も探索する
  const startDirs = [cwd]
  if (env.WORK_HUB_APP_DIR) startDirs.push(env.WORK_HUB_APP_DIR)

  let envPath: string | null = null
  for (const dir of startDirs) {
    envPath = findEnvFile(dir)
    if (!envPath) continue

    const value = parseEnv(readFileSync(envPath, 'utf-8')).DATABASE_URL
    if (value) return value
  }

  const where = envPath
    ? `${envPath} に DATABASE_URL の記述がありません`
    : `${startDirs.map((d) => resolve(d)).join(', ')} から上位ディレクトリを探索しましたが .env が見つかりません`

  if (env.NODE_ENV === 'production') {
    throw new Error(
      `DATABASE_URL を解決できませんでした（${where}）。` +
        '環境変数 DATABASE_URL を設定するか、アプリのルートに .env を配置してください。',
    )
  }

  console.warn(
    `[db] DATABASE_URL が未設定のため開発用の接続先を使用します（${where}）`,
  )
  return DEV_FALLBACK_DATABASE_URL
}
