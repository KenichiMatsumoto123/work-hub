/**
 * 工数実績の正規化保存：E2E（クリティカルパス）シナリオ E2E-1〜E2E-7
 *
 * 根拠：`docs/設計/工数実績の正規化保存/_review/test/観点表.md` 2 章（凍結済み・人間承認済み）。
 * 2.0 節の共通前提・2.1 節のセレクタ仕様・2.2 節のシナリオ仕様にそのまま従う。
 *
 * 2.0 節の規定：
 * 1. 各シナリオは保存前に専用のセンチネル日付を入力する（E2E-1 = 2000-01-01 … E2E-7 = 2000-01-07）。
 *    保存を成立させない意図のシナリオでも必ず入力する
 * 2. 各シナリオは他シナリオの実行結果・画面状態に依存しない
 * 3. 後始末は test.afterEach で成否によらず実行し、自分のセンチネル日付の
 *    time_entries → daily_reports の順に削除する（2 章はマスタを残す。truncateTables() は使わない）
 * 4. ログイン済みが既定（playwright.config.ts の storageState）。未認証を見る E2E-6 のみ個別に扱う
 * 5. マスタ名はシナリオごとに一意にする（E2E<番号>- を接頭辞にする）
 * 6. タイマー起点は saved-msg の表示を「観測した時刻」（クリック時刻ではない）
 */
import { test, expect, request as apiRequest, type Page } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { db } from '../src/server/db'
import { dailyReports, timeEntries } from '../src/server/schema'
import { AUTO_CLEAR_MS } from '../src/lib/saved-msg'
import { E2E_USER } from './fixtures/e2e-user'

// ---------------------------------------------------------------------------
// 後始末（2.0 節 規定 3）：自分のセンチネル日付の time_entries → daily_reports の順に削除する
// ---------------------------------------------------------------------------

async function cleanupSentinelDate(date: string): Promise<void> {
  await db.delete(timeEntries).where(eq(timeEntries.date, date))
  await db.delete(dailyReports).where(eq(dailyReports.date, date))
}

// ---------------------------------------------------------------------------
// 2.1 節のセレクタ仕様
// ---------------------------------------------------------------------------

function dateInput(page: Page) {
  return page.locator('input[type="date"]')
}
function clientNameInput(page: Page) {
  return page.getByPlaceholder('取引先', { exact: true })
}
// 「プロジェクト」「タスク名」は ReflectionSection の textarea の placeholder
// （例：「【プロジェクト名】タスク名\n→コメント」）に部分一致するため、
// { exact: true } を付けて対象行の Input 要素だけに絞る
// （観点表 2.1 節が指す実体は components/report/TaskRow.tsx のこの Input）
function projectNameInput(page: Page) {
  return page.getByPlaceholder('プロジェクト', { exact: true })
}
function taskNameInput(page: Page) {
  return page.getByPlaceholder('タスク名', { exact: true })
}
function actualHoursInput(page: Page) {
  return page.getByPlaceholder('実績h', { exact: true })
}
function saveButton(page: Page) {
  return page.getByRole('button', { name: /日報保存/ })
}
function savedMsg(page: Page) {
  return page.getByTestId('saved-msg')
}

/**
 * `saveReportFn` へのサーバ関数リクエストか判定する
 * （`apps/web/e2e/auth.test.ts` の `isReportsServerFn` と同型。既存テストは変更しないため複製する）。
 * サーバ関数の URL は `/_serverFn/<定義元を base64url した id>` の形になっている。
 */
function isReportsServerFn(url: string): boolean {
  const marker = '/_serverFn/'
  const idx = url.indexOf(marker)
  if (idx === -1) return false
  const id = url.slice(idx + marker.length).split('?')[0]
  try {
    return Buffer.from(decodeURIComponent(id), 'base64url')
      .toString('utf-8')
      .includes('functions/reports')
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// E2E-4・E2E-5 共通：saved-msg のテキストをポーリングして記録する
// （観点表 E2E-4 ⑤「50ms 間隔でポーリングして記録」に従う。
//  page.on('response') は HTTP レスポンスの記録手段であり表示文言の観測にならないため使わない）
// ---------------------------------------------------------------------------

type MsgSnapshot = { t: number; text: string }

/**
 * `Locator.textContent()` は既定で actionTimeout（本リポジトリの設定では 0 = 無期限）に従い、
 * 要素が現れるまで待ち続ける。saved-msg 要素がまだ存在しない場面（成功前・エラー前）で
 * 素朴に `.textContent().catch(() => '')` を呼ぶと、`.catch` に落ちる間もなく1回の呼び出しが
 * 無期限に待機し続け、ポーリングにならない（実測：クリックからテストの外側タイムアウトまで
 * 一度もポーリングログが出ないまま固まることを確認した）。
 * 1回のポーリング試行を確実に短時間で終わらせるため、`{ timeout }` を明示する。
 */
const POLL_ATTEMPT_TIMEOUT_MS = 1000

async function readSavedMsgTextOnce(page: Page): Promise<string> {
  return (await savedMsg(page).textContent({ timeout: POLL_ATTEMPT_TIMEOUT_MS }).catch(() => '')) ?? ''
}

async function collectSavedMsgTimeline(
  page: Page,
  opts: { intervalMs: number; totalMs: number },
): Promise<MsgSnapshot[]> {
  const start = Date.now()
  const snapshots: MsgSnapshot[] = []
  while (Date.now() - start < opts.totalMs) {
    const text = await readSavedMsgTextOnce(page)
    snapshots.push({ t: Date.now(), text })
    await page.waitForTimeout(opts.intervalMs)
  }
  return snapshots
}

/** `needle` を含む文言が saved-msg に現れるまで `intervalMs` 間隔でポーリングし、観測した時刻を返す */
async function waitForMsgContains(
  page: Page,
  needle: string,
  opts: { intervalMs: number; timeoutMs: number },
): Promise<number> {
  const start = Date.now()
  for (;;) {
    const text = await readSavedMsgTextOnce(page)
    if (text.includes(needle)) return Date.now()
    if (Date.now() - start >= opts.timeoutMs) {
      throw new Error(`"${needle}" を含む saved-msg が ${opts.timeoutMs}ms 以内に現れなかった`)
    }
    await page.waitForTimeout(opts.intervalMs)
  }
}

/**
 * ハイドレーション完了待ち（実測に基づく対処）。
 *
 * SSR 直後はまだ React のハイドレーションが終わっておらず、クリックしても onClick が
 * 一切発火しないことがある（`apps/web/e2e/auth.test.ts` のログアウトテストが同種の対策を
 * 既に採っている）。本ファイルでは「タブを切り替えて戻す」という、日報データに副作用を
 * 一切与えない純クライアント操作（`setActiveTab` のみ）を用いて、クリックが実際に効くように
 * なるまで再試行する。確認後は必ず入力タブに戻す。
 * 実測：対策前は保存ボタンのクリックが無反応のまま saved-msg 待ちが無期限に固まっていた。
 */
async function waitForHydration(page: Page): Promise<void> {
  const toDaily = page.getByRole('button', { name: /📝 日報/ })
  const toInput = page.getByRole('button', { name: /✏️ 入力/ })

  await expect(async () => {
    await toDaily.click({ timeout: 2000 })
    await expect(page.getByText('(1) 日報テキスト')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 30000, intervals: [200, 500, 1000] })

  await toInput.click({ timeout: 2000 })
  await expect(dateInput(page)).toBeVisible()
}

// ---------------------------------------------------------------------------
// E2E-5 専用：AUTO_CLEAR タイマー（setTimeout(fn, 2000)）が実際に張られた時刻 t0 を直接観測する。
//
// 観点表は E2E-5 の判定を `T2 < T1 + 2000` としているが、AC-65 本来の条件は `T2 < t0 + 2000`
// であり、`T1`（saved-msg の表示を「観測した」時刻）は t0（setTimeout が実際に呼ばれた時刻）より
// 後ろにずれる（レンダリング・ポーリング間隔の分だけ δ=T1-t0 が乗る）。
//
// この δ を消すため、ページ読み込み前に window.setTimeout を計測用にラップする
// （page.addInitScript。アプリの実装コードは一切変更しない。効果を持つのは対象ページの
// 実行コンテキストのみで、`~/lib/saved-msg.ts` の `runSavedMsgEffects` が呼ぶ
// `window.setTimeout(callback, ms)` を透過的に横取りし、元の関数へはそのまま委譲する）。
// AUTO_CLEAR_MS（=2000）と一致する呼び出しの発生時刻だけを記録することで、
// t0 をミリ秒精度で直接取得できる。
// ---------------------------------------------------------------------------

async function installAutoClearTimerProbe(page: Page, autoClearMs: number): Promise<void> {
  await page.addInitScript((targetMs: number) => {
    const w = window as unknown as { __autoClearSetTimeoutLog: number[] }
    w.__autoClearSetTimeoutLog = []
    const original = window.setTimeout.bind(window)
    // @ts-expect-error 計測用の透過ラッパーであり、setTimeout の型を完全に維持する必要はない
    window.setTimeout = (handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout === targetMs) {
        w.__autoClearSetTimeoutLog.push(Date.now())
      }
      return original(handler, timeout, ...args)
    }
  }, autoClearMs)
}

async function readAutoClearTimerLog(page: Page): Promise<number[]> {
  return page.evaluate(
    () => (window as unknown as { __autoClearSetTimeoutLog?: number[] }).__autoClearSetTimeoutLog ?? [],
  )
}

// ---------------------------------------------------------------------------
// ウォームアップ（実測に基づく対処）：
//
// `npm run dev`（Vite dev server）はモジュールを初回リクエスト時に遅延コンパイルする。
// このファイルの最初の保存操作が `/` の初回コンパイル（実測で 10 秒超）と
// `saveReportFn`／`report-normalize.ts` 等サーバ関数モジュールの初回コンパイルを
// 同時に踏むと、シナリオ内のポーリング待ち時間（数秒オーダー）を容易に超過する
// （実測：`page.goto('/')` に 13275ms かかったケースを確認）。
// 2.0 節のシナリオ本体はタイマー精度の検証（E2E-5 等）を含むため、
// 各シナリオの中に長大なコールドスタート分の待ち時間を混ぜたくない。
//
// そこで 7 シナリオの前に 1 回だけ、実データを作らない保存操作（対象行 0 件。
// 5-1／E2E-3 と同じ経路）でモジュールを温める。ウォームアップ専用の日付は
// 1.0 節の日付割当表・2.0 節のセンチネル日付のいずれにも使われていない
// `2000-01-09` を用いる（後始末で削除する）。
// `beforeAll`/`afterAll` は fullyParallel 環境では実行したワーカーごとに走るが、
// 同じ日付への保存は onConflictDoUpdate のため衝突せず安全である。
// ---------------------------------------------------------------------------

const WARMUP_DATE = '2000-01-09'

test.beforeAll(async ({ browser, baseURL }, testInfo) => {
  // beforeAll フック自体の既定タイムアウト（30000ms）はコールドスタートの実測値
  // （2 ワーカー同時実行下で 30 秒を超えるケースを確認）を吸収できないため個別に延ばす
  testInfo.setTimeout(90000)

  const context = await browser.newContext({ baseURL, storageState: E2E_USER.storageState })
  const page = await context.newPage()
  try {
    await page.goto('/')
    await waitForHydration(page)
    await dateInput(page).fill(WARMUP_DATE)
    await saveButton(page).click()
    // コールドスタートを見込んだ、この呼び出しだけの特別な長い待ち時間
    await waitForMsgContains(page, '保存しました', { intervalMs: 200, timeoutMs: 80000 })
  } finally {
    await context.close()
  }
})

test.afterAll(async () => {
  await cleanupSentinelDate(WARMUP_DATE)
})

// ---------------------------------------------------------------------------
// E2E-1
// ---------------------------------------------------------------------------

test.describe('E2E-1 保存の正常系（完走）', () => {
  const date = '2000-01-01'

  test.afterEach(async () => {
    await cleanupSentinelDate(date)
  })

  test('必要項目を入力して日報保存を押すと保存しました✓が表示される', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await dateInput(page).fill(date)
    await clientNameInput(page).fill('E2E1-取引先')
    await projectNameInput(page).fill('E2E1-PJ')
    await taskNameInput(page).fill('E2E1-タスク')
    await actualHoursInput(page).fill('1.5')

    await saveButton(page).click()

    await expect(savedMsg(page)).toContainText('保存しました ✓')
  })
})

// ---------------------------------------------------------------------------
// E2E-2
// ---------------------------------------------------------------------------

test.describe('E2E-2 二重保存（冪等性が保存エラーとして表面化しない）', () => {
  const date = '2000-01-02'

  test.afterEach(async () => {
    await cleanupSentinelDate(date)
  })

  test('同じ内容で連続保存してもどちらも保存しました✓が表示される', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await dateInput(page).fill(date)
    await clientNameInput(page).fill('E2E2-取引先')
    await projectNameInput(page).fill('E2E2-PJ')
    await taskNameInput(page).fill('E2E2-タスク')
    await actualHoursInput(page).fill('1.5')

    const isSavePost = (res: { request: () => { method: () => string }; url: () => string }) =>
      res.request().method() === 'POST' && isReportsServerFn(res.url())

    // 1 回目：POST 完了を確定させ、saved-msg が消えるのを待ってから 2 回目を押す
    const firstResponsePromise = page.waitForResponse(isSavePost)
    await saveButton(page).click()
    const firstResponse = await firstResponsePromise
    expect(firstResponse.status(), '1回目の保存が 200 以外で応答した').toBe(200)
    await expect(savedMsg(page)).toContainText('保存しました ✓')
    await expect(savedMsg(page)).toBeHidden({ timeout: AUTO_CLEAR_MS + 1000 })

    // 2 回目：POST も waitForResponse で確定させる（クリックの空振りでの false PASS を防ぐ）
    const secondResponsePromise = page.waitForResponse(isSavePost)
    await saveButton(page).click()
    const secondResponse = await secondResponsePromise
    expect(secondResponse.status(), '2回目の保存が 200 以外で応答した').toBe(200)

    await expect(savedMsg(page)).toContainText('保存しました ✓')
    await expect(savedMsg(page)).not.toContainText('保存エラー')
  })
})

// ---------------------------------------------------------------------------
// E2E-3
// ---------------------------------------------------------------------------

test.describe('E2E-3 前提データがない状態（対象行0件）', () => {
  const date = '2000-01-03'

  test.afterEach(async () => {
    await cleanupSentinelDate(date)
  })

  test('実績hを入力せず保存しても保存しました✓が表示される', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await dateInput(page).fill(date)
    // 実績h は入力しない（defaultDailyReport() の初期状態のまま＝対象行 0 件）

    await saveButton(page).click()

    const el = savedMsg(page)
    await expect(el).toContainText('保存しました ✓')
    await expect(el).not.toContainText('保存エラー')
  })
})

// ---------------------------------------------------------------------------
// E2E-4
// ---------------------------------------------------------------------------

test.describe('E2E-4 主要な異常系（入力不正）とエラー表示', () => {
  const date = '2000-01-04'

  test.afterEach(async () => {
    await cleanupSentinelDate(date)
  })

  test('実績h=25で保存するとエラー表示が3秒間残り、成功文言は一度も現れない', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await dateInput(page).fill(date)
    await actualHoursInput(page).fill('25')
    // テンプレ保存ボタンは押さない

    // 操作開始（クリック）と同時にポーリングを開始する。
    // 4500ms = エラー表示までの往復時間 + 3000ms の持続確認 + 余裕
    const clickPromise = saveButton(page).click()
    const timeline = await collectSavedMsgTimeline(page, { intervalMs: 50, totalMs: 4500 })
    await clickPromise

    // ⑤ 保存しました ✓ が一度も現れない
    expect(
      timeline.some((s) => s.text.includes('保存しました')),
      '操作開始から保存しました✓が一度でも観測された',
    ).toBe(false)

    // ① saved-msg に 保存エラー を含む文字列が表示される（最初に観測できた時刻を t0 とする）
    const firstError = timeline.find((s) => s.text.includes('保存エラー'))
    expect(firstError, '保存エラーを含む saved-msg が観測できなかった').toBeTruthy()
    const t0 = firstError!.t

    // ② class="text-danger" ③ class="whitespace-pre-line"
    const el = savedMsg(page)
    await expect(el).toHaveClass(/text-danger/)
    await expect(el).toHaveClass(/whitespace-pre-line/)

    // ④ t0（観測時刻）から3秒間、連続して表示され続けている（クリック時刻起点にしない）
    const windowSamples = timeline.filter((s) => s.t >= t0 && s.t <= t0 + 3000)
    expect(windowSamples.length, 't0 から3秒間のサンプルが取得できていない').toBeGreaterThan(0)
    expect(
      windowSamples.every((s) => s.text.includes('保存エラー')),
      't0 から3秒以内にエラー表示が消えた（保存エラー以外のテキストが観測された）',
    ).toBe(true)
    // 3秒ぶんのサンプルを実際に取り切れていること（取りこぼし防止）
    expect(timeline[timeline.length - 1].t, '3秒間のポーリングが完了する前にタイムラインが終わっていた').toBeGreaterThanOrEqual(
      t0 + 3000,
    )
  })
})

// ---------------------------------------------------------------------------
// E2E-5
// ---------------------------------------------------------------------------

test.describe('E2E-5 中断／再開（成功直後の失敗でタイマーが取り消される）', () => {
  const date = '2000-01-05'

  test.afterEach(async () => {
    await cleanupSentinelDate(date)
  })

  test('成功直後に失敗すると先行タイマーが取り消され、エラー表示が消されない', async ({ page }) => {
    // AUTO_CLEAR タイマー（setTimeout(fn, 2000)）が実際に張られた時刻 t0 を直接観測する準備
    await installAutoClearTimerProbe(page, AUTO_CLEAR_MS)

    await page.goto('/')
    await waitForHydration(page)
    await dateInput(page).fill(date)
    await clientNameInput(page).fill('E2E5-取引先')
    await projectNameInput(page).fill('E2E5-PJ')
    await taskNameInput(page).fill('E2E5-タスク')
    await actualHoursInput(page).fill('1.5')

    // 1 回目：成功させる。saved-msg の表示を観測した時刻 T1 を記録する
    await saveButton(page).click()
    const t1 = await waitForMsgContains(page, '保存しました', { intervalMs: 50, timeoutMs: 5000 })

    // t0：AUTO_CLEAR タイマーが実際に setTimeout(fn, 2000) された時刻（レンダリング前・T1 より前）
    const timerLog = await readAutoClearTimerLog(page)
    expect(timerLog.length, 'AUTO_CLEAR タイマーの setTimeout 呼び出しが1回だけ観測できること').toBe(1)
    const t0 = timerLog[0]
    // t0 は setTimeout が呼ばれた時刻であり、その後の再描画を経て T1 が観測される。
    // したがって t0 <= T1 が成り立つはずである（測定手段の健全性チェック）。
    expect(t0, 't0（タイマー設置時刻）が T1（表示観測時刻）より後になっている').toBeLessThanOrEqual(t1)

    // 実績h を書き換えて2回目の保存（失敗させる）
    await actualHoursInput(page).fill('25')

    // ①（ハードアサーション）：2回目のクリック直前に saved-msg が成功文言を表示したままであること
    const beforeSecondClick = await readSavedMsgTextOnce(page)
    expect(
      beforeSecondClick,
      '2回目のクリック直前に成功メッセージが既に消えていた（窓を外れた実行のため無効）',
    ).toContain('保存しました')

    await saveButton(page).click()
    const t2 = await waitForMsgContains(page, '保存エラー', { intervalMs: 50, timeoutMs: 5000 })

    // 主判定に用いる、AC-65 本来の条件：T2 < t0 + 2000
    // （観点表の `T2 < T1 + 2000` は t0 の代わりに T1 を使うため δ=T1-t0 だけ緩い。
    //  本テストは window.setTimeout を直接計測して t0 を得ているため、本来の条件で判定する）
    expect(
      t2,
      `T2(${t2}) が t0(${t0})+2000=${t0 + 2000} 以上だった（タイマー窓の外での実行のため無効）`,
    ).toBeLessThan(t0 + AUTO_CLEAR_MS)

    // 補助：観点表 E2E-5 ③ が要求する T1 起点の delta も記録・検証する（t0 起点の判定を補強する）
    expect(t2 - t1, `T2-T1(${t2 - t1}) が ${AUTO_CLEAR_MS}ms 以上だった`).toBeLessThan(AUTO_CLEAR_MS)

    // ②（主判定）：T2 から3秒間、エラー表示が連続して残っている
    const timeline = await collectSavedMsgTimeline(page, { intervalMs: 100, totalMs: 3300 })
    const afterT2 = timeline.filter((s) => s.t >= t2)
    expect(afterT2.length, 'T2 以降のサンプルが取得できていない').toBeGreaterThan(0)
    expect(
      afterT2.every((s) => s.text.includes('保存エラー')),
      'T2 から3秒以内にエラー表示が消えた（先行タイマーが取り消されていない）',
    ).toBe(true)
    expect(timeline[timeline.length - 1].t, '3秒間のポーリングが完了する前にタイムラインが終わっていた').toBeGreaterThanOrEqual(
      t2 + 3000,
    )
  })
})

// ---------------------------------------------------------------------------
// E2E-6
// ---------------------------------------------------------------------------

test.describe('E2E-6 未認証での保存・削除（権限なし）', () => {
  const date = '2000-01-06'

  test.afterEach(async () => {
    await cleanupSentinelDate(date)
  })

  test('saveReportFn・deleteReportFn とも未認証では401が返る', async ({ page, baseURL }) => {
    // page.route はクリックより前に登録する
    let resolveSaveUrl: (url: string) => void
    const saveUrlPromise = new Promise<string>((resolve) => {
      resolveSaveUrl = resolve
    })
    await page.route('**/_serverFn/**', async (route) => {
      const req = route.request()
      if (req.method() === 'POST' && isReportsServerFn(req.url())) {
        resolveSaveUrl(req.url())
        await route.abort()
        return
      }
      await route.continue()
    })

    await page.goto('/')
    await waitForHydration(page)
    await dateInput(page).fill(date)
    // 画面操作を伴うシナリオは、保存を成立させない意図であっても必ずセンチネル日付を入力する

    await saveButton(page).click()
    const saveUrl = await saveUrlPromise

    // saveReportFn の URL（/_serverFn/<base64url(JSON.stringify({file, export}))>）から
    // deleteReportFn の URL を導出する（export を saveReportFn_createServerFn_handler →
    // deleteReportFn_createServerFn_handler に差し替える）
    const deleteUrl = deriveDeleteUrlFromSaveUrl(saveUrl)

    // クッキーを持たないリクエストコンテキストから、本文を送らずに両方へ POST する
    // （content-type: application/json を付けると requireSession より前に
    //  seroval の fromJSON が壊れた本文で throw し、認証未検証のまま 500 になるため）
    const anonymous = await apiRequest.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    })
    try {
      const saveRes = await anonymous.post(saveUrl)
      const deleteRes = await anonymous.post(deleteUrl)

      expect(saveRes.status(), `saveReportFn が 401 以外を返した（${saveRes.status()}）`).toBe(401)
      expect(deleteRes.status(), `deleteReportFn が 401 以外を返した（${deleteRes.status()}）`).toBe(401)
    } finally {
      await anonymous.dispose()
    }
  })
})

function deriveDeleteUrlFromSaveUrl(saveUrl: string): string {
  const marker = '/_serverFn/'
  const url = new URL(saveUrl)
  const idx = url.pathname.indexOf(marker)
  if (idx === -1) {
    throw new Error(`saveReportFn の URL に ${marker} が含まれていない: ${saveUrl}`)
  }
  const id = url.pathname.slice(idx + marker.length)

  const decoded = JSON.parse(Buffer.from(decodeURIComponent(id), 'base64url').toString('utf-8')) as {
    export: string
    [key: string]: unknown
  }
  if (!decoded.export || !decoded.export.startsWith('saveReportFn_createServerFn_handler')) {
    throw new Error(`想定外の export 値: ${JSON.stringify(decoded)}`)
  }

  const deleteExport = decoded.export.replace(
    'saveReportFn_createServerFn_handler',
    'deleteReportFn_createServerFn_handler',
  )
  const newId = Buffer.from(JSON.stringify({ ...decoded, export: deleteExport }), 'utf-8').toString(
    'base64url',
  )

  url.pathname = `${url.pathname.slice(0, idx)}${marker}${newId}`
  return url.toString()
}

// ---------------------------------------------------------------------------
// E2E-7
// ---------------------------------------------------------------------------

test.describe('E2E-7 成功メッセージの自動消去（現行挙動の維持）', () => {
  const date = '2000-01-07'

  test.afterEach(async () => {
    await cleanupSentinelDate(date)
  })

  test('保存しました✓の表示は観測から3秒以内に消える', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await dateInput(page).fill(date)
    await clientNameInput(page).fill('E2E7-取引先')
    await projectNameInput(page).fill('E2E7-PJ')
    await taskNameInput(page).fill('E2E7-タスク')
    await actualHoursInput(page).fill('1.5')

    await saveButton(page).click()
    // 表示を観測してから、追加操作をせずに待つ（起点はクリック時刻ではなく観測時刻）
    await waitForMsgContains(page, '保存しました', { intervalMs: 50, timeoutMs: 5000 })

    await expect(savedMsg(page)).toBeHidden({ timeout: 3000 })
  })
})
