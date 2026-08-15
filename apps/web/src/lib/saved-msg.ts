/**
 * 保存メッセージ（`savedMsg`）の状態管理ロジック
 * — 設計書「UI の変更（エラー表示）> 実装構造の規定」
 *
 * 副作用（setTimeout / clearTimeout）は関数の中で実行せず、
 * 「実行すべき副作用の一覧」を戻り値として返す純粋関数（reducer）と、
 * タイマー API と dispatch を注入して副作用を実行する関数に分ける。
 */

/** 予約中の自動消去タイマー ID（未予約なら null） */
export type SavedMsgState = {
  /** 表示中のメッセージ */
  message: string
  /** エラー扱いか（true なら text-danger + whitespace-pre-line） */
  isError: boolean
  /** 予約中の自動消去タイマー ID */
  timerId: number | null
}

/** reducer が受け取るイベント（設計書「実装構造の規定」の 6 種） */
export type SavedMsgEvent =
  | { type: 'reportSaveSucceeded'; date: string }
  | { type: 'reportSaveFailed'; message: string }
  | { type: 'templateSaveSucceeded' }
  | { type: 'templateSaveFailed' }
  | { type: 'dateMissing' }
  | { type: 'autoClearFired' }

/** reducer が出力する副作用 */
export type SavedMsgEffect =
  | { type: 'clearTimeout'; id: number }
  | { type: 'setTimeout'; ms: number }

/** reducer の出力（次の状態と、実行すべき副作用の配列） */
export type SavedMsgResult = {
  state: SavedMsgState
  effects: SavedMsgEffect[]
}

/** 副作用実行関数へ注入するタイマー API */
export type TimerApi = {
  setTimeout: (callback: () => void, ms: number) => number
  clearTimeout: (id: number) => void
}

/** 自動消去タイマーの待ち時間（ms）。現行実装の値を維持する */
export const AUTO_CLEAR_MS = 2000

/** 初期状態 */
export const initialSavedMsgState: SavedMsgState = {
  message: '',
  isError: false,
  timerId: null,
}

/** 予約中タイマーがあれば clearTimeout 副作用を積む（無ければ何もしない） */
function clearPendingTimer(state: SavedMsgState, effects: SavedMsgEffect[]): void {
  if (state.timerId !== null) {
    effects.push({ type: 'clearTimeout', id: state.timerId })
  }
}

/** イベントに対する次の状態と副作用を返す純粋関数 */
export function savedMsgReducer(state: SavedMsgState, event: SavedMsgEvent): SavedMsgResult {
  switch (event.type) {
    case 'reportSaveSucceeded': {
      const effects: SavedMsgEffect[] = []
      clearPendingTimer(state, effects)
      effects.push({ type: 'setTimeout', ms: AUTO_CLEAR_MS })
      return {
        state: { message: `${event.date} の日報を保存しました ✓`, isError: false, timerId: null },
        effects,
      }
    }
    case 'reportSaveFailed': {
      const effects: SavedMsgEffect[] = []
      clearPendingTimer(state, effects)
      return {
        state: {
          message: `保存エラー${event.message ? `: ${event.message}` : ''}`,
          isError: true,
          timerId: null,
        },
        effects,
      }
    }
    case 'templateSaveSucceeded': {
      const effects: SavedMsgEffect[] = []
      clearPendingTimer(state, effects)
      effects.push({ type: 'setTimeout', ms: AUTO_CLEAR_MS })
      return {
        state: { message: 'テンプレート保存済 ✓', isError: false, timerId: null },
        effects,
      }
    }
    case 'templateSaveFailed': {
      const effects: SavedMsgEffect[] = []
      clearPendingTimer(state, effects)
      effects.push({ type: 'setTimeout', ms: AUTO_CLEAR_MS })
      return {
        state: { message: '保存エラー', isError: false, timerId: null },
        effects,
      }
    }
    case 'dateMissing': {
      const effects: SavedMsgEffect[] = []
      clearPendingTimer(state, effects)
      effects.push({ type: 'setTimeout', ms: AUTO_CLEAR_MS })
      return {
        state: { message: '日付を入力してください', isError: false, timerId: null },
        effects,
      }
    }
    case 'autoClearFired': {
      return {
        state: { message: '', isError: false, timerId: null },
        effects: [],
      }
    }
  }
}

/**
 * 副作用を実行し、`setTimeout` を実行した場合はその ID を返す（実行しなければ null）。
 * `setTimeout` に渡すコールバックは、注入された dispatch へ
 * 「自動消去の発火」イベントを送るだけの関数とする。
 */
export function runSavedMsgEffects(
  effects: SavedMsgEffect[],
  deps: { timers: TimerApi; dispatch: (event: SavedMsgEvent) => void },
): number | null {
  let timerId: number | null = null

  for (const effect of effects) {
    if (effect.type === 'clearTimeout') {
      deps.timers.clearTimeout(effect.id)
    } else {
      timerId = deps.timers.setTimeout(() => {
        deps.dispatch({ type: 'autoClearFired' })
      }, effect.ms)
    }
  }

  return timerId
}
