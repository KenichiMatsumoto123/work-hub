# Red Phase Evidence

- 機能：日報の自動読み込み
- 実施日時：2026-08-16 09:15 UTC（Phase 6 Round 2 修正後の再検証）
- テスト作成：test-builder（fresh context・Composer 2.5）／Red Phase 検証：司令塔が独立再実行
- 実行コマンド：`npm run test`（リポジトリルート）

## マーカー

- new-feature-tests: FAIL（91 tests・全件期待値不一致またはスタブ throw。import エラーなし）
- new-feature-allowed-pass: PASS（8 tests。定数 5 + `dateMissing` + AC-L53 タブ断片 + `defaultDailyReport(date)` 引数）
- regression-baseline: PASS（226 tests）
- impl-files-unchanged: 確認済（振る舞い関数は throw。`onDateChange` のみ固定 `{ action: 'none' }`）

合計: 91 failed | 234 passed (325)

## 新規テストの失敗内訳

| テストファイル | Fail件数 | 主な失敗理由 |
|---|---|---|
| `report-load.test.ts` | 45 / 50 | スタブ throw（`shouldConfirmSpaLeave` 含む） |
| `report-load-flow.test.ts` | 21 / 21 | スタブ throw / `onDateChange` が confirm せず `none` |
| `time-utils.test.ts`（追記） | 4 | UTC / AC-L05 |
| `defaults.test.ts` | 2 / 3 | `getToday` 未使用 |
| `storage.test.ts` | 2 | swallow |
| `index.report-load.test.ts` | 11 / 13 | AC-L60/L62。dateMissing とタブ断片 AC-L53 は PASS |
| `reports.test.ts`（追記） | 6 | AC-L13 / AC-L12 |

## 既存テスト

226 件 PASS。`saved-msg.test.ts` 未変更。

## 補足

- Round 2 修正: `markReportSaved` / `shouldConfirmSpaLeave` / `onBeforeFetch`。AC-L53 はファイル全体の confirm 禁止を廃止
- Playwright 未作成
- `requireSession` は Red のため未付与
