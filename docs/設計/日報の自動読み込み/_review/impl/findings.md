# Phase 10 実装レビュー findings

- 機能：日報の自動読み込み
- 較正：敵対的（3レーン並列）
- 報告閾値：Critical / Major のみ
- 実装承認：スキップ（フロー設定）／収束をもって承認

---

## Round 1（2026-08-16）

レーン A（仕様忠実性）・レーン B（セキュリティ）は Critical 0・Major 0。レーン C（テストのすり抜け）が Major 1 件。マージ規則に従い削除・軟化せず掲載する。

### FIND-001: 本番 401 が throw せず resolve され、AC-L43 リダイレクト経路を通らない

- **観点**: テストのすり抜け
- **重大度**: Major
- **ファイル**: `apps/web/src/lib/report-load.ts:227-241`, `apps/web/src/lib/report-load.ts:254-261`, `apps/web/src/lib/storage.ts:47-49`, `apps/web/src/test/vitest.setup.ts:1-18`, `apps/web/src/lib/report-load-flow.test.ts:205-218`
- **失敗シナリオ**: ログイン済みで `/` を開いた後にセッションが失効し、日付変更・再試行・再読み込みで `getReportByDateFn` が 401 を返すと、AC-L43 どおり `/login?redirect=/` へ飛ばず「読み込みに失敗しました」バナーが出て再試行を繰り返す。
- **問題**: TanStack Start のクライアント fetch は、ミドルウェアが throw した 401 `Response`（body: `{"error":"UNAUTHORIZED"}`）を **例外にせず resolve** する。`reportStorage.getByDate` はその値をそのまま返し、`startLoad` の `catch`（当時 L254–261）の `isUnauthorizedError` には入らない。L234–241 では `{ error: 'UNAUTHORIZED' }` を「構造不正の非 null 応答」とみなし `loadStatus: 'error'` にするだけで、`assignLocation(LOGIN_ON_401_HREF)` は一度も呼ばれない。AC-L43・AC-L44 の想定（401 失敗 → リダイレクト、通常失敗バナーなし）と乖離する。
- **テストがこれを検出できない理由**:
  - `vitest.setup.ts` が `getReportByDateFn` を `fetchReportByDate` 直呼びに差し替え、**本番と同型の 401 HTTP 応答を再現しない**（MC-9）。
  - `report-load-flow.test.ts` L205–218 は `getByDate: vi.fn().mockRejectedValue(Response 401)` の **throw 経路のみ**。本番の resolve 経路を一度も通していない（MC-7）。
  - E2E は未認証を `beforeLoad` リダイレクトで遮断し、401 カタログシナリオ（設計書 E2E 候補）も未コード化。HTTP 401 ステータス断言（`auth.test.ts` / `effort-normalize` E2E-6）は **createServerFn クライアントの resolve 形状を見ない**。
- **推奨対応**: `startLoad` の await 直後で、resolve 値が 401 エラー形状なら `assignLocation` して return。または `reportStorage.getByDate` で 401 形状を検出して throw し、既存 catch 経路に統一。あわせて **本番と同型の 401 resolve** を返す結合テストを追加（Vitest setup だけに依存しない）。
- **戻り先**: Phase 8（実装）
- **Round 1 後の対応**: impl-builder が `checkUnauthorizedValue` に文字列 `'UNAUTHORIZED'` 判定を追加し、`startLoad` の resolve 経路で `isUnauthorizedError(report)` なら `assignLocation(LOGIN_ON_401_HREF)` するよう修正。テストは変更していない（推奨の結合テスト追加は Phase 5 のため本ループでは実施しない）。

### レーン A Round 1 確認の裏付け

- AC-L01〜L05：`getToday` は `Intl` + `Asia/Tokyo` + `formatToParts`。`defaultDailyReport()` の date は `getToday()`。
- AC-L10〜L15：`fetchReportByDate` は不正日付で DB 非接触、行ありは `rowToReport`、0件は null。`getReportByDateFn` に `requireSession`。`getByDate` は例外を再throw。`applyLoadSuccess` は null なら empty、非 null なら `{ ...report, date: D }`。
- AC-L20〜L24 / L30〜L37 / L40〜L46 / L50〜L56 / L60〜L63：設計書どおり。読み込みに `getAllReportsFn` は未使用。

### レーン B Round 1 確認の裏付け

- MC-2：新規 PII フィールドなし。
- MC-3：`requireSession` + `eq(dailyReports.date, date)`。`user_id` はデータモデルに無い。
- 401 の href は `'/login?redirect=/'` 固定。クエリは Drizzle `eq()`。XSS 経路（`dangerouslySetInnerHTML`）なし。N+1 なし。

---

## Round 2（2026-08-16・差分レビュー）

| FIND-ID | 解消判定 | 根拠 |
|---|---|---|
| FIND-001 | **解消** | resolve した `{ error: 'UNAUTHORIZED' }` は `checkUnauthorizedValue` の `.error` 再帰と文字列判定で true。`startLoad` は stale のあと・`isLoadableReport` の前に `assignLocation(LOGIN_ON_401_HREF)` する。正当な `DailyReportData` の note は走査しない。stale 時はリダイレクトしない |

新規 Critical / Major：該当なし。

---

## 実装承認

実装承認: スキップ（フロー設定）／収束をもって承認
