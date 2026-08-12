/**
 * .env の読み込みと環境変数（DATABASE_URL・認証設定など）の解決
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

/** 環境変数1件の解決結果。値が無い場合に「どこを探したか」を説明できるようにする */
export type EnvLookup = {
  /** 見つかった値（環境変数または .env の記述）。見つからなければ undefined */
  value: string | undefined
  /** 探索で見つかった .env のパス（.env 自体が無ければ null） */
  envPath: string | null
  /** 探索の起点にしたディレクトリ（エラーメッセージ用） */
  startDirs: string[]
}

/**
 * 環境変数を「環境変数 → 親ディレクトリを遡って見つけた .env」の順で解決する。
 * 見つからない場合も探索経路を返し、呼び出し側が原因の分かるメッセージを組み立てられるようにする。
 */
export function lookupEnvValue(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): EnvLookup {
  // cwd 起点で見つからない場合に備え、サーバー起動スクリプトが渡すアプリ配置先も探索する
  const startDirs = [cwd]
  if (env.WORK_HUB_APP_DIR) startDirs.push(env.WORK_HUB_APP_DIR)

  if (env[key]) return { value: env[key], envPath: null, startDirs }

  let envPath: string | null = null
  for (const dir of startDirs) {
    const found = findEnvFile(dir)
    if (!found) continue

    envPath = found
    const value = parseEnv(readFileSync(found, 'utf-8'))[key]
    if (value) return { value, envPath, startDirs }
  }

  return { value: undefined, envPath, startDirs }
}

/** lookupEnvValue の結果から「どこを探したか」の説明文を作る */
export function describeEnvLookup(key: string, lookup: EnvLookup): string {
  return lookup.envPath
    ? `${lookup.envPath} に ${key} の記述がありません`
    : `${lookup.startDirs.map((d) => resolve(d)).join(', ')} から上位ディレクトリを探索しましたが .env が見つかりません`
}

/**
 * 環境変数を解決する。見つからなければ undefined を返す。
 * 値の有無で分岐したいだけの呼び出し側（任意設定）向けの薄いラッパ。
 */
export function resolveEnvValue(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string | undefined {
  return lookupEnvValue(key, env, cwd).value
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
  const lookup = lookupEnvValue('DATABASE_URL', env, cwd)
  if (lookup.value) return lookup.value

  const where = describeEnvLookup('DATABASE_URL', lookup)

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
