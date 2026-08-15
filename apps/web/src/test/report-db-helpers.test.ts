/**
 * `report-db-helpers.ts` の `deleteByDates` が使う id フィルタ純粋関数の単体テスト。
 *
 * Phase 6 Round 3 FIND-R3B-01（Major）：ガードA（規定 10）が対象日を書き込み前に必ず
 * 空にするため、結合テストの実行では「保存前スナップショットに含まれる id は削除しない」
 * という分岐が構造的に到達しない。将来この分岐が無条件削除（全件返却）へ退行しても、
 * どの結合テストも落ちない状態だった。ロジックを DB 非依存の純粋関数
 * `selectDeleteTargetIds`（`report-db-delete-targets.ts`）に切り出し、ここで直接検証する。
 *
 * 観点表の変更は不要（Round 1 で `hasRequireSessionMiddleware` の回帰テストを
 * 観点表の変更なしに追加した前例と同じ扱い）。
 */
import { describe, it, expect } from 'vitest'
import { selectDeleteTargetIds } from './report-db-delete-targets'

describe('selectDeleteTargetIds', () => {
  it('保存前スナップショットに含まれる id は削除対象にならないこと', () => {
    const snapshotIds = new Set(['existing-1', 'existing-2'])
    const currentIds = ['existing-1', 'existing-2']

    const targets = selectDeleteTargetIds(currentIds, snapshotIds)

    expect(targets).toEqual([])
  })

  it('保存前スナップショットに含まれない id だけが削除対象になること', () => {
    const snapshotIds = new Set(['existing-1'])
    const currentIds = ['existing-1', 'new-1', 'new-2']

    const targets = selectDeleteTargetIds(currentIds, snapshotIds)

    expect(targets).toEqual(['new-1', 'new-2'])
  })

  it('スナップショットに存在する id と存在しない id が混在する場合、存在する id だけが除外されること', () => {
    const snapshotIds = new Set(['keep-a', 'keep-b'])
    const currentIds = ['keep-a', 'delete-a', 'keep-b', 'delete-b']

    const targets = selectDeleteTargetIds(currentIds, snapshotIds)

    expect(targets).toEqual(['delete-a', 'delete-b'])
  })

  it('スナップショットが空集合の場合、現在の id が全件削除対象になること', () => {
    const snapshotIds = new Set<string>()
    const currentIds = ['a', 'b', 'c']

    const targets = selectDeleteTargetIds(currentIds, snapshotIds)

    expect(targets).toEqual(['a', 'b', 'c'])
  })

  it('現在の id が 0 件の場合、削除対象も 0 件になること', () => {
    const snapshotIds = new Set(['existing-1'])
    const currentIds: string[] = []

    const targets = selectDeleteTargetIds(currentIds, snapshotIds)

    expect(targets).toEqual([])
  })
})
