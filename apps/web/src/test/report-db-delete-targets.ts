/**
 * 観点表 1.0 節 規定 3（Phase 6 Round 2 FIND-C01）の「保存前から存在した行は削除しない」
 * 防御の核心ロジックを、DB クライアントに依存しない純粋関数として切り出したもの。
 *
 * `report-db-helpers.ts` の `deleteByDates` から呼ばれる。DB や環境変数に一切依存しないため
 * `report-db-helpers.test.ts`（`npm run test` レベル・DB 不要）で直接検証できる
 * （Phase 6 Round 3 FIND-R3B-01・Major）。
 *
 * ガードA（対象日を書き込み前に必ず空にする。規定 10）が通過した結合テスト実行では、
 * 対象日の保存前スナップショットは構造的に必ず空集合になるため、「スナップショットに
 * 含まれる id は削除しない」という分岐は結合テストのどの実行でも到達しない。
 * この分岐が将来「無条件 DELETE」へ退行しても結合テストは検出できないため、
 * この純粋関数への単体テストが唯一の検証手段になる。
 */

/**
 * `currentIds`（現在その日付に存在する行の id）のうち、`snapshotIds`
 * （保存前スナップショットに含まれる id＝テストが書き込む前から存在した行の id）に
 * **含まれない** id だけを削除対象として返す。
 *
 * スナップショットに含まれる id（＝テストが書き込む前から存在した行）は、
 * どれだけ `currentIds` に含まれていても削除対象に含めない。
 */
export function selectDeleteTargetIds(
  currentIds: readonly string[],
  snapshotIds: ReadonlySet<string>,
): string[] {
  return currentIds.filter((id) => !snapshotIds.has(id))
}
