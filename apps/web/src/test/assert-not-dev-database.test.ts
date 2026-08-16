/**
 * `assert-not-dev-database.ts` の単体テスト。
 *
 * Phase 6 Round 4 FIND-R4-M02（Major）：規定 10 ガードBの中核ロジック
 * （`resolveEffectiveDbName`。前回の Critical＝FIND-LC-C01 の修正そのもの）に
 * 自動テストが 1 件も無かった。DB にも環境変数にも副作用を及ぼさない純粋関数のため
 * `npm run test` レベルで直接検証できる（`report-db-helpers.test.ts` の
 * `selectDeleteTargetIds` と同じ位置づけ）。
 *
 * `PGDATABASE` を書き換えるテストがあるため、`beforeEach`/`afterEach` で必ず元の状態
 * （未設定なら未設定）に復元する。Round 1 FIND-009 と同じ「未設定だった変数に文字列
 * "undefined" を代入してしまう」事故を避けるため、`hasOwnProperty` で「そもそも
 * 設定されていたか」を記録してから delete/代入で復元する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../server/env', () => ({
  resolveDatabaseUrl: vi.fn(),
}))

import { resolveDatabaseUrl } from '../server/env'
import { assertNotDevDatabase, resolveEffectiveDbName } from './assert-not-dev-database'

describe('assert-not-dev-database', () => {
  let hadPgDatabase: boolean
  let originalPgDatabase: string | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    hadPgDatabase = Object.prototype.hasOwnProperty.call(process.env, 'PGDATABASE')
    originalPgDatabase = process.env.PGDATABASE
  })

  afterEach(() => {
    if (hadPgDatabase) {
      process.env.PGDATABASE = originalPgDatabase
    } else {
      delete process.env.PGDATABASE
    }
  })

  describe('resolveEffectiveDbName', () => {
    it('パスが省略されている場合、username を返すこと', () => {
      delete process.env.PGDATABASE

      expect(resolveEffectiveDbName('postgres://workhub:pw@host:5432')).toBe('workhub')
    })

    it('末尾スラッシュのみでパス部分が空の場合、username を返すこと', () => {
      delete process.env.PGDATABASE

      expect(resolveEffectiveDbName('postgres://workhub:pw@host:5432/')).toBe('workhub')
    })

    it('パスがある場合、pathname の値を返すこと', () => {
      expect(
        resolveEffectiveDbName('postgres://workhub:pw@host:5432/workhub_test'),
      ).toBe('workhub_test')
    })

    it('pathname があれば、PGDATABASE が設定されていても pathname を優先すること', () => {
      // fallback の優先順位（pathname → PGDATABASE → username）が崩れていないかを見る。
      // PGDATABASE を先に見る退行は、この 1 件だけを検出力の要として置いている。
      process.env.PGDATABASE = 'should-be-ignored'

      expect(
        resolveEffectiveDbName('postgres://workhub:pw@host:5432/workhub_test'),
      ).toBe('workhub_test')
    })

    it('パスが省略されており PGDATABASE が設定されている場合、PGDATABASE の値を返すこと', () => {
      process.env.PGDATABASE = 'foo'

      expect(resolveEffectiveDbName('postgres://workhub:pw@host:5432')).toBe('foo')
    })

    it('パスが省略されており PGDATABASE が未設定の場合、username を返すこと（username フォールバック）', () => {
      delete process.env.PGDATABASE

      // DEV_DATABASE_NAME（'workhub'）と紛れないよう、別の username で確認する
      expect(resolveEffectiveDbName('postgres://someuser:pw@host:5432')).toBe('someuser')
    })

    it('URL として解析できない文字列は fail-closed で throw すること', () => {
      expect(() => resolveEffectiveDbName('not a valid url')).toThrow()
    })

    it('pathname も PGDATABASE も username も無い場合は fail-closed で throw すること', () => {
      delete process.env.PGDATABASE

      expect(() => resolveEffectiveDbName('postgres://host:5432')).toThrow()
    })
  })

  describe('assertNotDevDatabase', () => {
    it('接続先が開発用データベース名（workhub）の場合に throw すること', () => {
      vi.mocked(resolveDatabaseUrl).mockReturnValue('postgres://workhub:pw@localhost:5432/workhub')

      expect(() => assertNotDevDatabase()).toThrow()
    })

    it('接続先が開発用データベース名以外の場合は throw しないこと', () => {
      vi.mocked(resolveDatabaseUrl).mockReturnValue(
        'postgres://workhub:pw@localhost:5432/workhub_test',
      )

      expect(() => assertNotDevDatabase()).not.toThrow()
    })
  })
})
