/**
 * 保存メッセージの reducer と副作用実行関数（テスト観点表 1.6 節 6-4）
 *
 * 対象 AC：AC-79・AC-80・AC-81・AC-82・AC-86・AC-87（および AC-65 の単体側の担保）
 * 根拠：設計書「UI の変更（エラー表示）> 実装構造の規定」の表（イベント 6 種）
 *
 * 文言は現行実装（routes/index.tsx:102-121）の逐語コピーであり、本機能で変更しない。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  savedMsgReducer,
  runSavedMsgEffects,
  AUTO_CLEAR_MS,
  type SavedMsgEffect,
  type SavedMsgEvent,
  type SavedMsgState,
  type TimerApi,
} from './saved-msg'

/** 予約中タイマーが無い状態 */
const idle: SavedMsgState = { message: '', isError: false, timerId: null }
/** 予約中タイマー ID が識別可能な値で入っている状態（AC-86） */
const pending: SavedMsgState = { message: '前のメッセージ', isError: false, timerId: 12345 }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('savedMsgReducer：次の状態', () => {
  it('日報保存の成功では対象日付を含む成功文言になりエラー扱いにならない', () => {
    const result = savedMsgReducer(idle, {
      type: 'reportSaveSucceeded',
      date: '2000-01-01',
    })

    expect(result.state).toEqual({
      message: '2000-01-01 の日報を保存しました ✓',
      isError: false,
      timerId: null,
    })
  })

  it('日報保存の失敗ではメッセージ本文を連結しエラー扱いになる', () => {
    const result = savedMsgReducer(idle, {
      type: 'reportSaveFailed',
      message: '実績工数が上限（24時間）を超えています。\n「調査」= 25',
    })

    expect(result.state).toEqual({
      message: '保存エラー: 実績工数が上限（24時間）を超えています。\n「調査」= 25',
      isError: true,
      timerId: null,
    })
  })

  it('日報保存の失敗でメッセージ本文が空なら「保存エラー」だけになる', () => {
    const result = savedMsgReducer(idle, { type: 'reportSaveFailed', message: '' })

    expect(result.state).toEqual({ message: '保存エラー', isError: true, timerId: null })
  })

  it('テンプレ保存の成功ではテンプレート用の文言になる', () => {
    const result = savedMsgReducer(idle, { type: 'templateSaveSucceeded' })

    expect(result.state).toEqual({
      message: 'テンプレート保存済 ✓',
      isError: false,
      timerId: null,
    })
  })

  it('テンプレ保存の失敗はエラー扱いにしない（AC-81）', () => {
    const result = savedMsgReducer(idle, { type: 'templateSaveFailed' })

    expect(result.state).toEqual({ message: '保存エラー', isError: false, timerId: null })
  })

  it('日付未入力では入力を促す文言になる', () => {
    const result = savedMsgReducer(idle, { type: 'dateMissing' })

    expect(result.state).toEqual({
      message: '日付を入力してください',
      isError: false,
      timerId: null,
    })
  })

  it('自動消去の発火ではメッセージが空になる', () => {
    const result = savedMsgReducer(
      { message: '2000-01-01 の日報を保存しました ✓', isError: false, timerId: 12345 },
      { type: 'autoClearFired' },
    )

    expect(result.state).toEqual({ message: '', isError: false, timerId: null })
  })
})

describe('savedMsgReducer：出力する副作用', () => {
  const autoClearEvents: SavedMsgEvent[] = [
    { type: 'reportSaveSucceeded', date: '2000-01-01' },
    { type: 'templateSaveSucceeded' },
    { type: 'templateSaveFailed' },
    { type: 'dateMissing' },
  ]

  it.each(autoClearEvents)(
    '$type は自動消去の setTimeout（2000ms）を出力する（AC-80）',
    (event) => {
      const result = savedMsgReducer(idle, event)

      // AC-80 の「2000ms」をリテラルで束縛する（SUT の export をそのまま期待値にしない。FIND-001）
      expect(result.effects).toEqual([{ type: 'setTimeout', ms: 2000 }])
    },
  )

  it.each(autoClearEvents)(
    '$type は予約中タイマーがあれば先に clearTimeout を出力する（AC-86）',
    (event) => {
      const result = savedMsgReducer(pending, event)

      expect(result.effects).toEqual([
        { type: 'clearTimeout', id: 12345 },
        { type: 'setTimeout', ms: 2000 },
      ])
    },
  )

  it('日報保存の失敗は clearTimeout だけを出力し setTimeout を出力しない', () => {
    const result = savedMsgReducer(pending, { type: 'reportSaveFailed', message: 'x' })

    expect(result.effects).toEqual([{ type: 'clearTimeout', id: 12345 }])
  })

  it('日報保存の失敗は予約中タイマーが無ければ副作用を出力しない', () => {
    const result = savedMsgReducer(idle, { type: 'reportSaveFailed', message: 'x' })

    expect(result.effects).toEqual([])
  })

  it('自動消去の発火は副作用を1つも出力しない（AC-82）', () => {
    const result = savedMsgReducer(
      { message: '保存しました ✓', isError: false, timerId: 12345 },
      { type: 'autoClearFired' },
    )

    expect(result.effects).toEqual([])
  })

  it('成功の直後に失敗すると、先行タイマーの取り消しだけが出力される（AC-65）', () => {
    const first = savedMsgReducer(idle, { type: 'reportSaveSucceeded', date: '2000-01-05' })
    // 実行側の書き戻しで確定した ID を第 2 呼び出しの入力に与える
    const second = savedMsgReducer(
      { ...first.state, timerId: 999 },
      { type: 'reportSaveFailed', message: '実績工数が上限（24時間）を超えています。' },
    )

    expect(second.effects).toEqual([{ type: 'clearTimeout', id: 999 }])
  })
})

describe('runSavedMsgEffects：副作用の実行', () => {
  /** 注入する偽のタイマー API。呼び出し内容を記録する */
  function makeTimers(setTimeoutReturn = 777) {
    const setTimeoutCalls: { callback: () => void; ms: number }[] = []
    const clearTimeoutCalls: number[] = []
    const timers: TimerApi = {
      setTimeout: (callback, ms) => {
        setTimeoutCalls.push({ callback, ms })
        return setTimeoutReturn
      },
      clearTimeout: (id) => {
        clearTimeoutCalls.push(id)
      },
    }
    return { timers, setTimeoutCalls, clearTimeoutCalls }
  }

  it('setTimeout 副作用を含む場合、注入した setTimeout の戻り値をそのまま返す（AC-79）', () => {
    const { timers } = makeTimers(777)
    const effects: SavedMsgEffect[] = [{ type: 'setTimeout', ms: AUTO_CLEAR_MS }]

    const returned = runSavedMsgEffects(effects, { timers, dispatch: vi.fn() })

    expect(returned).toBe(777)
  })

  it('setTimeout 副作用を含まない場合は null を返す（AC-79）', () => {
    const { timers } = makeTimers()
    const effects: SavedMsgEffect[] = [{ type: 'clearTimeout', id: 12345 }]

    const returned = runSavedMsgEffects(effects, { timers, dispatch: vi.fn() })

    expect(returned).toBeNull()
  })

  it('clearTimeout 副作用は指定された ID を注入した clearTimeout に渡す（AC-79）', () => {
    const { timers, clearTimeoutCalls } = makeTimers()
    const effects: SavedMsgEffect[] = [{ type: 'clearTimeout', id: 12345 }]

    runSavedMsgEffects(effects, { timers, dispatch: vi.fn() })

    expect(clearTimeoutCalls).toEqual([12345])
  })

  it('setTimeout には副作用の ms がそのまま渡る（AC-87）', () => {
    const { timers, setTimeoutCalls } = makeTimers()
    // 入力と期待値に同一定数（AUTO_CLEAR_MS）を使うとハードコード実装を落とせないため、
    // 識別可能な別値を使い pass-through を検証する（FIND-002）
    const DISTINCT_MS = 1234
    const effects: SavedMsgEffect[] = [{ type: 'setTimeout', ms: DISTINCT_MS }]

    runSavedMsgEffects(effects, { timers, dispatch: vi.fn() })

    expect(setTimeoutCalls.map((call) => call.ms)).toEqual([DISTINCT_MS])
  })

  it('setTimeout のコールバックは自動消去の発火を1回 dispatch する（AC-87）', () => {
    const { timers, setTimeoutCalls } = makeTimers()
    const dispatch = vi.fn()

    runSavedMsgEffects([{ type: 'setTimeout', ms: AUTO_CLEAR_MS }], { timers, dispatch })

    // コールバック起動前は dispatch されていないこと（コールバック外での先行 dispatch を落とす。FIND-003）
    expect(setTimeoutCalls.length).toBe(1)
    expect(dispatch.mock.calls).toEqual([])

    setTimeoutCalls[0].callback()

    expect(dispatch.mock.calls).toEqual([[{ type: 'autoClearFired' }]])
  })
})
