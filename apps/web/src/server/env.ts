import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * モノレポ root の `.env` を読み込み、未設定のキーのみ process.env へ載せる。
 *
 * 既存 `db.ts` は DATABASE_URL を個別にパースしていたが、better-auth など
 * 他のサーバ設定も同じ root `.env` を参照するため、ロード処理を共通化する。
 * import 時に一度だけ実行される（多重 import されても loaded フラグで防ぐ）。
 */
let loaded = false

export function loadRootEnv(): void {
  if (loaded) return
  loaded = true

  // 起動ディレクトリによって root `.env` の相対位置が変わるため、候補を順に探す。
  // - ローカル開発: cwd = apps/web → ../../.env がモノレポ root
  // - 本番 VPS: pm2 をモノレポ root（/opt/work-hub）から起動 → ./.env が root
  const candidates = [
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
  ]

  let content: string | null = null
  for (const candidate of candidates) {
    try {
      content = readFileSync(candidate, 'utf-8')
      break
    } catch {
      // 候補が存在しなければ次へ
    }
  }
  // .env が無い環境（本番でシェル env を直接設定する等）は無視
  if (content === null) return

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    // 値が引用符で囲まれている場合は外す
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    // シェル env が優先（既に設定済みのキーは上書きしない）
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadRootEnv()
