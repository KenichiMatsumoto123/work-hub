/**
 * `vitest.integration.config.ts` の `setupFiles` からロードされる薄いエントリ。
 * ガードB（`assert-not-dev-database.ts`）を `*.integration.test.ts` 全ファイルに
 * 無条件適用する（Phase 6 Round 3 FIND-LC-M01・Major）。
 *
 * `report-db-helpers.ts` を import するファイルではそちらでも同じ関数が呼ばれるが、
 * 副作用の無い同期チェックであるため二重に走っても問題ない（冪等）。
 */
import { assertNotDevDatabase } from './assert-not-dev-database'

assertNotDevDatabase()
