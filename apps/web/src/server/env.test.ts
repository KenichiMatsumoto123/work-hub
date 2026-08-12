import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DEV_FALLBACK_DATABASE_URL, findEnvFile, resolveDatabaseUrl } from './env'

const PROD_URL = 'postgresql://workhub:ab958533@localhost:5432/workhub'

/** リポジトリ直下に .env がある本番相当の構成を作る（envContent が null なら .env なし） */
function createRepo(envContent: string | null = `DATABASE_URL=${PROD_URL}\n`) {
  const root = mkdtempSync(join(tmpdir(), 'work-hub-test-'))
  const webDir = join(root, 'apps', 'web')
  mkdirSync(webDir, { recursive: true })
  if (envContent !== null) writeFileSync(join(root, '.env'), envContent)
  return { root, webDir }
}

describe('findEnvFile', () => {
  let repo: ReturnType<typeof createRepo>

  beforeEach(() => {
    repo = createRepo()
  })
  afterEach(() => rmSync(repo.root, { recursive: true, force: true }))

  it('下位ディレクトリから上位の .env を見つける', () => {
    expect(findEnvFile(repo.webDir)).toBe(join(repo.root, '.env'))
  })

  it('同じディレクトリの .env を見つける', () => {
    expect(findEnvFile(repo.root)).toBe(join(repo.root, '.env'))
  })
})

describe('resolveDatabaseUrl', () => {
  let repo: ReturnType<typeof createRepo>

  beforeEach(() => {
    repo = createRepo()
  })
  afterEach(() => {
    rmSync(repo.root, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('環境変数 DATABASE_URL を最優先する', () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: 'postgres://env' }, repo.webDir)).toBe(
      'postgres://env',
    )
  })

  it('cwd がリポジトリ直下でも .env を読める（pm2 起動相当）', () => {
    // `cd /opt/work-hub && pm2 start apps/web/serve.mjs` で cwd がリポジトリ直下になるケース。
    // 以前は cwd/../../.env を見ていたため .env を読めず、開発用の認証情報で接続していた。
    expect(resolveDatabaseUrl({ NODE_ENV: 'production' }, repo.root)).toBe(PROD_URL)
  })

  it('cwd が apps/web でも .env を読める（npm run start 相当）', () => {
    expect(resolveDatabaseUrl({ NODE_ENV: 'production' }, repo.webDir)).toBe(PROD_URL)
  })

  it('WORK_HUB_APP_DIR を起点に .env を探す', () => {
    const elsewhere = mkdtempSync(join(tmpdir(), 'work-hub-cwd-'))
    try {
      expect(
        resolveDatabaseUrl(
          { NODE_ENV: 'production', WORK_HUB_APP_DIR: repo.webDir },
          elsewhere,
        ),
      ).toBe(PROD_URL)
    } finally {
      rmSync(elsewhere, { recursive: true, force: true })
    }
  })

  it('コメント・引用符・前方一致する別キーが混ざっていても DATABASE_URL を取り出す', () => {
    const messy = createRepo(
      [
        '# DATABASE_URL=postgres://commented-out/db',
        'DATABASE_URL_OLD=postgres://old/db',
        `export DATABASE_URL="${PROD_URL}"`,
      ].join('\r\n'),
    )
    try {
      expect(resolveDatabaseUrl({ NODE_ENV: 'production' }, messy.root)).toBe(PROD_URL)
    } finally {
      rmSync(messy.root, { recursive: true, force: true })
    }
  })

  it('.env はあるが DATABASE_URL の記述が無い場合は本番で失敗する', () => {
    const noKey = createRepo('OTHER=1\n')
    try {
      expect(() => resolveDatabaseUrl({ NODE_ENV: 'production' }, noKey.root)).toThrow(
        /DATABASE_URL/,
      )
    } finally {
      rmSync(noKey.root, { recursive: true, force: true })
    }
  })

  it('本番で .env が見つからない場合は開発用フォールバックを使わず失敗する', () => {
    const empty = createRepo(null)
    try {
      expect(() => resolveDatabaseUrl({ NODE_ENV: 'production' }, empty.webDir)).toThrow(
        /DATABASE_URL/,
      )
    } finally {
      rmSync(empty.root, { recursive: true, force: true })
    }
  })

  it('開発時は警告を出して既定の接続先を使う', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const empty = createRepo(null)
    try {
      expect(resolveDatabaseUrl({}, empty.webDir)).toBe(DEV_FALLBACK_DATABASE_URL)
      expect(warn).toHaveBeenCalled()
    } finally {
      rmSync(empty.root, { recursive: true, force: true })
    }
  })
})
