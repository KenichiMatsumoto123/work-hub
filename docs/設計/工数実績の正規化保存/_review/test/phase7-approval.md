# Phase 7（人間によるテスト承認ゲート）記録

- **承認日時**：2026-08-15
- **フロー設定**：Phase 7（テスト承認）＝**実施**（`_flow-config.md`）
- **判定**：**承認**（人間）
- **承認時点のコミット**：`05a770f`

## 承認の前提となった状態

| 項目 | 状態 |
|---|---|
| Phase 6 の収束 | **達成**（Round 5 で Critical 0・Major 0） |
| AC 対応マトリクス | ✅76 / ⚠️0 / ❌0 / N/A8 |
| `npm run check-types` | PASS |
| `npm run test` | 132 FAIL / 81 PASS（213） |
| `npm run test:integration` | 56 FAIL / 19 PASS（75） |
| `npm run db:push` | `No changes detected` |
| Red Phase の性質 | 保持（SUT に対する新規テストの FAIL 132 件は Round 1 から一貫して不変。PASS の増加 +18 はすべてテスト基盤自身の回帰テスト） |

## 承認に伴う決定

### FIND-R5-M01 は「文書化のみで通過」とする

`decodeURIComponent(parsed.username)` を除去する退行を、新規 10 件のテストが検出できない（Round 5 レーンA+B が実測）。

- 司令塔は「percent-encoded username のケースを 1 件足すだけで閉じられる」として**閉じることを推奨**した
- 人間は残存 Minor を含めた現状のテストを**承認**した。`AGENTS.md` の lean 運用「レビュー findings の Minor は文書化のみで通過可」に基づき、**本項目は文書化のみで通過とする**
- **現行コードにはデコードがあるため実害はゼロ**であり、指摘の実体は検出力の空洞のみである
- **Phase 8 ではテストを修正できない**（`flow-phase8-impl` の前提）。本項目を閉じる場合は Phase 10 完了後に別途行うこと

### その他の Minor

Round 1〜5 の Minor（計 16 件程度）はいずれも各 findings ファイルに記録済みで、lean 運用により文書化のみで通過。

## 未決事項 No.1（`db:push` 前の確認）

設計書は「`clients` / `projects` / `tasks` に手動投入されたデータが無いか」の確認を **`npm run db:push` の前まで**に人間が実施することと定めている。

**司令塔がこのコンテナの DB（`workhub_test`）に対して 6 クエリを実行した結果：**

| 確認 | 結果 |
|---|---|
| (a1) `clients` の名前重複 | **0 件** |
| (a2) `projects` の (client_id, name) 重複 | **0 件** |
| (a3) `tasks` の (project_id, client_id, title) 重複 | **0 件** |
| (b1) `clients` の非正規化な名前 | **0 件** |
| (b2) `projects` の非正規化な名前 | **0 件** |
| (b3) `tasks` の非正規化な title | **0 件** |

したがって**このコンテナの DB では S-1〜S-3 の追加は成功する**。

> **⚠️ ただしこれは検証環境の DB に対する結果である。**利用者の実際の開発 DB / 本番 DB に対する確認は**別途人間が実施する必要がある**（設計書 未決事項 No.1 の「確認は人間が実施する」はこちらを指す）。実 DB に対して `npm run db:push` を行う前に、設計書 未決事項 No.1 の 6 クエリを実行すること。
> - (a) が 1 行でも返る場合：重複を手で統合してから `db:push` する（制約追加が失敗するため）
> - (b) が返る場合：そのレコードは本機能から再利用されず新しいレコードが並んで作られる。実害が無ければ放置可

## 次フェーズ

**Phase 8（実装・Green Phase）**へ進む。`flow-phase9-refactor`（Phase 9）は lean 運用により明らかに不要なら省略可、`flow-phase10-impl-review`（Phase 10）は省略不可。
