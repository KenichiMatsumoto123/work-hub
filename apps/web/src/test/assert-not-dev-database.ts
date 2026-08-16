/**
 * 観点表 1.0 節 規定 10（Phase 6 Round 3 FIND-R3-C01・Critical）のガードB：
 * 開発 DB への接続を機構で拒否する。
 *
 * DB クライアント（`../server/db`）やスキーマに一切依存しない独立モジュールとして
 * 切り出してある。`report-db-helpers.ts` から呼ばれるのに加えて、
 * `vitest.integration.config.ts` の `setupFiles`（`assert-not-dev-database-setup.ts`）
 * からも呼ばれ、`report-db-helpers.ts` を import しない結合テスト（例：
 * `auth.integration.test.ts`）にも機構で強制する（Phase 6 Round 3 FIND-LC-M01・Major）。
 * 呼び出し側が複数あっても、このガードは `DATABASE_URL` 文字列を読んで判定するだけの
 * 副作用の無い同期処理であるため、同一ファイル内で複数回呼ばれても結果は変わらない（冪等）。
 */
import { resolveDatabaseUrl } from '../server/env'

const DEV_DATABASE_NAME = 'workhub'

/**
 * postgres-js（`node_modules/postgres/src/index.js` の `parseOptions`）が実際に使う
 * DB 名解決のフォールバック連鎖を再現する（Phase 6 Round 3 FIND-LC-C01 の修正）：
 *
 * ```js
 * database: o.database || o.db || (url.pathname || '').slice(1) || env.PGDATABASE || user
 * user    : o.user || o.username || url.username || env.PGUSERNAME || env.PGUSER || osUsername()
 * ```
 *
 * 本リポジトリは `postgres(urlString)` を文字列 1 本で呼ぶ（オプションオブジェクトを渡さない）
 * ため、`o.database` / `o.db` / `o.user` / `o.username` は常に無く対象外でよい。
 * 再現するのは `(url.pathname || '').slice(1) → env.PGDATABASE → url.username` までで、
 * それも無い場合（`PGUSERNAME` / `PGUSER` / OS ユーザー名まで連鎖するケース）は
 * 「接続文字列にユーザー名を含めない運用」自体を本リポジトリで使っておらず、
 * 判定不能とみなして **fail-closed（起動拒否）** にする。
 *
 * 旧実装は `new URL(url)` が例外を投げた場合に「判定しない＝素通しする」fail-open な
 * 設計だったが、DB 名を確定できないケースは安全側に倒し、常に起動を拒否する
 * fail-closed に改めた（例外を投げるのは「解析不能」自体の理由。DB 名が
 * 最終的に決定できないケースも同様に拒否する）。
 *
 * **`PGUSERNAME` / `PGUSER` / OS ユーザー名フォールバックを実装しない判断について**
 * （Phase 6 Round 4 FIND-R4-LC-M01・Minor。修正しないことを確定）：
 * この 3 段を実装すると、現在 fail-closed で拒否している一部の接続文字列
 * （pathname 無し・`PGDATABASE` 未設定・接続文字列にユーザー名も無いケース）が
 * 判定を通過するようになる——つまりガード**B の安全側（過検知）をわざわざ緩める**
 * 変更になる。`.env.example` / `docker-compose.yml` / `ci.yml` はいずれも
 * `DATABASE_URL` に user 部を含むため、この 3 段が無いことによる誤検知（正規の
 * 接続文字列を誤って拒否する）は実測上発生しない。したがって実装しない。
 */
export function resolveEffectiveDbName(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch (cause) {
    throw new Error(
      '[assert-not-dev-database] DATABASE_URL を URL として解析できませんでした。' +
        '接続先データベース名を判定できないため、fail-closed の方針により結合テストの起動を拒否します。\n' +
        `DATABASE_URL: ${url}`,
      { cause: cause as Error },
    )
  }

  const fromPathname = parsed.pathname.replace(/^\//, '')
  if (fromPathname) return fromPathname

  if (process.env.PGDATABASE) return process.env.PGDATABASE

  const fromUsername = decodeURIComponent(parsed.username)
  if (fromUsername) return fromUsername

  throw new Error(
    '[assert-not-dev-database] DATABASE_URL からデータベース名を判定できませんでした' +
      '（pathname 無し・PGDATABASE 未設定・接続文字列にユーザー名も無し）。' +
      'fail-closed の方針により結合テストの起動を拒否します。\n' +
      `DATABASE_URL: ${url}`,
  )
}

export function assertNotDevDatabase(): void {
  const url = resolveDatabaseUrl()
  const dbName = resolveEffectiveDbName(url)
  if (dbName !== DEV_DATABASE_NAME) return

  throw new Error(
    `[assert-not-dev-database] 結合テスト（DB込み）が開発用データベース「${DEV_DATABASE_NAME}」への接続を検出したため、起動を拒否しました。\n` +
      'このまま実行すると、saveReportFn の UPSERT（daily_reports.date のユニーク制約）により、' +
      '開発中の日報データが id を保持したまま中身だけサイレントに上書きされるおそれがあります' +
      '（観点表 1.0 節 規定 10・Phase 6 Round 3 FIND-R3-C01）。\n' +
      '対処方法: DATABASE_URL を開発用 DB とは別の DB に向けて実行してください。例:\n' +
      "  DATABASE_URL='postgres://workhub:workhub_dev@localhost:5432/workhub_test' npm run test:integration",
  )
}
