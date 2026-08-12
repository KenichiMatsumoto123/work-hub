import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DEV_FALLBACK_AUTH_SECRET, resolveAuthConfig } from './config'

const FULL_ENV = [
  'BETTER_AUTH_SECRET=secret-from-dotenv',
  'BETTER_AUTH_URL=https://work-hub.example',
  'GOOGLE_CLIENT_ID=id-from-dotenv',
  'GOOGLE_CLIENT_SECRET=secret-from-dotenv-google',
  'AUTH_ALLOWED_EMAILS=me@example.com, @example.org',
].join('\n')

/** リポジトリ直下に .env がある構成を作る（envContent が null なら .env なし） */
function createRepo(envContent: string | null = `${FULL_ENV}\n`) {
  const root = mkdtempSync(join(tmpdir(), 'work-hub-auth-test-'))
  const webDir = join(root, 'apps', 'web')
  mkdirSync(webDir, { recursive: true })
  if (envContent !== null) writeFileSync(join(root, '.env'), envContent)
  return { root, webDir }
}

describe('resolveAuthConfig', () => {
  let repo: ReturnType<typeof createRepo>

  beforeEach(() => {
    repo = createRepo()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    rmSync(repo.root, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('環境変数を最優先する', () => {
    const config = resolveAuthConfig(
      {
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'from-env',
        GOOGLE_CLIENT_ID: 'id-from-env',
        GOOGLE_CLIENT_SECRET: 'client-secret-from-env',
      },
      repo.webDir,
    )

    expect(config.secret).toBe('from-env')
    expect(config.google).toEqual({
      clientId: 'id-from-env',
      clientSecret: 'client-secret-from-env',
    })
  })

  it('環境変数が無ければ上位ディレクトリの .env から読む（pm2 起動相当）', () => {
    const config = resolveAuthConfig({ NODE_ENV: 'production' }, repo.webDir)

    expect(config.secret).toBe('secret-from-dotenv')
    expect(config.baseURL).toBe('https://work-hub.example')
    expect(config.google).toEqual({
      clientId: 'id-from-dotenv',
      clientSecret: 'secret-from-dotenv-google',
    })
  })

  it('AUTH_ALLOWED_EMAILS を許可リストへ変換する', () => {
    const config = resolveAuthConfig({ NODE_ENV: 'production' }, repo.webDir)
    expect(config.allowedEmails).toEqual(['me@example.com', '@example.org'])
  })

  it('AUTH_ALLOWED_EMAILS が無ければ null（制限なし）になり、本番では警告する', () => {
    const noAllowlist = createRepo(
      [
        'BETTER_AUTH_SECRET=s',
        'GOOGLE_CLIENT_ID=i',
        'GOOGLE_CLIENT_SECRET=cs',
      ].join('\n'),
    )
    try {
      const config = resolveAuthConfig(
        { NODE_ENV: 'production' },
        noAllowlist.root,
      )
      expect(config.allowedEmails).toBeNull()
      expect(console.warn).toHaveBeenCalled()
    } finally {
      rmSync(noAllowlist.root, { recursive: true, force: true })
    }
  })

  it('本番で BETTER_AUTH_SECRET が無ければ失敗する', () => {
    const noSecret = createRepo('GOOGLE_CLIENT_ID=i\nGOOGLE_CLIENT_SECRET=cs\n')
    try {
      expect(() =>
        resolveAuthConfig({ NODE_ENV: 'production' }, noSecret.root),
      ).toThrow(/BETTER_AUTH_SECRET/)
    } finally {
      rmSync(noSecret.root, { recursive: true, force: true })
    }
  })

  it('本番で Google のクライアント情報が無ければ失敗する', () => {
    const noGoogle = createRepo('BETTER_AUTH_SECRET=s\n')
    try {
      expect(() =>
        resolveAuthConfig({ NODE_ENV: 'production' }, noGoogle.root),
      ).toThrow(/GOOGLE_CLIENT_ID/)
    } finally {
      rmSync(noGoogle.root, { recursive: true, force: true })
    }
  })

  it('本番で .env が見つからない場合も設定不足として失敗する', () => {
    const empty = createRepo(null)
    try {
      expect(() =>
        resolveAuthConfig({ NODE_ENV: 'production' }, empty.webDir),
      ).toThrow(/BETTER_AUTH_SECRET/)
    } finally {
      rmSync(empty.root, { recursive: true, force: true })
    }
  })

  it('開発時は警告を出して開発用シークレットで起動する', () => {
    const empty = createRepo(null)
    try {
      const config = resolveAuthConfig({}, empty.webDir)
      expect(config.secret).toBe(DEV_FALLBACK_AUTH_SECRET)
      expect(config.google).toEqual({ clientId: '', clientSecret: '' })
      expect(console.warn).toHaveBeenCalled()
    } finally {
      rmSync(empty.root, { recursive: true, force: true })
    }
  })

  it('WORK_HUB_APP_DIR を起点に .env を探す', () => {
    const elsewhere = mkdtempSync(join(tmpdir(), 'work-hub-auth-cwd-'))
    try {
      const config = resolveAuthConfig(
        { NODE_ENV: 'production', WORK_HUB_APP_DIR: repo.webDir },
        elsewhere,
      )
      expect(config.secret).toBe('secret-from-dotenv')
    } finally {
      rmSync(elsewhere, { recursive: true, force: true })
    }
  })
})
