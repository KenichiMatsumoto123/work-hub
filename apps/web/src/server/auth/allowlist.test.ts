import { describe, it, expect } from 'vitest'
import { isEmailAllowed, normalizeEmail, parseAllowedEmails } from './allowlist'

describe('parseAllowedEmails', () => {
  it('未設定なら null（制限なし）を返す', () => {
    expect(parseAllowedEmails(undefined)).toBeNull()
    expect(parseAllowedEmails(null)).toBeNull()
  })

  it('空文字・空白だけの指定は null（制限なし）として扱う', () => {
    expect(parseAllowedEmails('')).toBeNull()
    expect(parseAllowedEmails('   \n  ')).toBeNull()
  })

  it('カンマ・空白・改行のどれで区切っても分解できる', () => {
    expect(parseAllowedEmails('a@example.com, b@example.com')).toEqual([
      'a@example.com',
      'b@example.com',
    ])
    expect(parseAllowedEmails('a@example.com b@example.com')).toEqual([
      'a@example.com',
      'b@example.com',
    ])
    expect(parseAllowedEmails('a@example.com\nb@example.com\n')).toEqual([
      'a@example.com',
      'b@example.com',
    ])
  })

  it('大文字・前後空白を正規化し、重複を除く', () => {
    expect(parseAllowedEmails(' A@Example.com , a@example.com ')).toEqual([
      'a@example.com',
    ])
  })
})

describe('isEmailAllowed', () => {
  it('許可リストが null なら誰でも許可する', () => {
    expect(isEmailAllowed('anyone@example.com', null)).toBe(true)
  })

  it('リストにあるアドレスを許可し、無いアドレスを拒否する', () => {
    const allowed = parseAllowedEmails('me@example.com')
    expect(isEmailAllowed('me@example.com', allowed)).toBe(true)
    expect(isEmailAllowed('other@example.com', allowed)).toBe(false)
  })

  it('大文字・前後空白の違いは無視して照合する', () => {
    const allowed = parseAllowedEmails('me@example.com')
    expect(isEmailAllowed('  ME@Example.COM ', allowed)).toBe(true)
  })

  it('@ 始まりのエントリはドメイン全体の許可として扱う', () => {
    const allowed = parseAllowedEmails('@example.com')
    expect(isEmailAllowed('anyone@example.com', allowed)).toBe(true)
    expect(isEmailAllowed('anyone@other.com', allowed)).toBe(false)
  })

  it('サブドメインは親ドメインの許可に含めない', () => {
    const allowed = parseAllowedEmails('@example.com')
    expect(isEmailAllowed('anyone@evil.example.com', allowed)).toBe(false)
  })

  it('ドメイン指定の後方一致で通り抜けない（example.com と notexample.com）', () => {
    const allowed = parseAllowedEmails('@example.com')
    expect(isEmailAllowed('anyone@notexample.com', allowed)).toBe(false)
  })

  it('リストがあるときメールアドレスが無い場合は拒否する', () => {
    const allowed = parseAllowedEmails('me@example.com')
    expect(isEmailAllowed(null, allowed)).toBe(false)
    expect(isEmailAllowed(undefined, allowed)).toBe(false)
    expect(isEmailAllowed('', allowed)).toBe(false)
  })

  it('メールアドレスの形になっていない値は拒否する', () => {
    const allowed = parseAllowedEmails('@example.com')
    expect(isEmailAllowed('example.com', allowed)).toBe(false)
    expect(isEmailAllowed('@example.com', allowed)).toBe(false)
    expect(isEmailAllowed('me@', allowed)).toBe(false)
  })

  it('複数エントリのうち1つに一致すれば許可する', () => {
    const allowed = parseAllowedEmails('a@example.com, @allowed.com')
    expect(isEmailAllowed('a@example.com', allowed)).toBe(true)
    expect(isEmailAllowed('b@allowed.com', allowed)).toBe(true)
    expect(isEmailAllowed('b@example.com', allowed)).toBe(false)
  })
})

describe('normalizeEmail', () => {
  it('前後の空白を除き小文字にする', () => {
    expect(normalizeEmail('  Me@Example.COM ')).toBe('me@example.com')
  })
})
