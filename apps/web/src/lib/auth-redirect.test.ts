import { describe, it, expect } from 'vitest'
import {
  DEFAULT_POST_LOGIN_PATH,
  isPublicPath,
  resolvePostLoginPath,
} from './auth-redirect'

describe('isPublicPath', () => {
  it('ログイン画面はログイン不要', () => {
    expect(isPublicPath('/login')).toBe(true)
  })

  it('better-auth のエンドポイントはログイン不要', () => {
    expect(isPublicPath('/api/auth/callback/google')).toBe(true)
  })

  it('アプリの画面は保護対象', () => {
    expect(isPublicPath('/')).toBe(false)
    expect(isPublicPath('/timesheet')).toBe(false)
    expect(isPublicPath('/attendance')).toBe(false)
  })

  it('/login で始まるだけの別パスは保護対象', () => {
    expect(isPublicPath('/login-report')).toBe(false)
  })
})

describe('resolvePostLoginPath', () => {
  it('未指定なら既定のパスへ', () => {
    expect(resolvePostLoginPath(undefined)).toBe(DEFAULT_POST_LOGIN_PATH)
    expect(resolvePostLoginPath(null)).toBe(DEFAULT_POST_LOGIN_PATH)
    expect(resolvePostLoginPath('')).toBe(DEFAULT_POST_LOGIN_PATH)
  })

  it('サイト内の絶対パスはそのまま使う（クエリ付きも含む）', () => {
    expect(resolvePostLoginPath('/timesheet')).toBe('/timesheet')
    expect(resolvePostLoginPath('/attendance?month=3')).toBe('/attendance?month=3')
  })

  it('外部URLは既定のパスに落とす', () => {
    expect(resolvePostLoginPath('https://evil.example/steal')).toBe(
      DEFAULT_POST_LOGIN_PATH,
    )
    expect(resolvePostLoginPath('http://evil.example')).toBe(
      DEFAULT_POST_LOGIN_PATH,
    )
  })

  it('プロトコル相対URLは既定のパスに落とす', () => {
    expect(resolvePostLoginPath('//evil.example')).toBe(DEFAULT_POST_LOGIN_PATH)
    expect(resolvePostLoginPath('/\\evil.example')).toBe(
      DEFAULT_POST_LOGIN_PATH,
    )
  })

  it('制御文字を含む値は既定のパスに落とす', () => {
    expect(resolvePostLoginPath('/\n//evil.example')).toBe(
      DEFAULT_POST_LOGIN_PATH,
    )
  })

  it('相対パスは既定のパスに落とす', () => {
    expect(resolvePostLoginPath('timesheet')).toBe(DEFAULT_POST_LOGIN_PATH)
  })

  it('ログイン画面へ戻す指定はループになるため既定のパスに落とす', () => {
    expect(resolvePostLoginPath('/login')).toBe(DEFAULT_POST_LOGIN_PATH)
    expect(resolvePostLoginPath('/login?error=x')).toBe(DEFAULT_POST_LOGIN_PATH)
  })
})
