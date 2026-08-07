---
name: flow-phase8-impl
description: "新規機能開発フロー Phase 8（実装・Green Phase）。実装ワーカー役割（impl-builder）のサブエージェントを fresh context で起動し、承認済み（Phase 7 の人間承認、またはスキップ設定時は Phase 6 レビュー収束）のテストを通す最小限の実装を行わせる。テストの修正は禁止。司令塔（メイン会話）はゲートの独立検証と Green Phase 証拠の記録を担当する。完了後は次フェーズ（Phase 9 リファクタ or Phase 10 実装検証）を案内する。使用トリガー: 「実装して」「Green Phase に入って」「Phase 8 を実行」「テストを通して」等。"
---

# Phase 8: 実装（Green Phase）

新規機能開発の標準10フェーズフロー（`docs/開発プロセス/設計から実装までのフロー.md` 参照）の **Phase 8** を担当するスキル。承認済み（Phase 7 の人間承認、またはフロー運用設定で Phase 7 不要の場合は Phase 6 レビュー収束時の自動承認）のテストを通す実装を、司令塔（メイン会話のAI）と分離された **fresh context** の `impl-builder` ワーカーエージェントが行う。

**ワーカーを分離する理由：** 実装者が「テストがなぜこう書かれたか」の会話履歴を持っていると、テストの意図に合わせ込んだ実装（または実装に都合よくテストを解釈する）余地が残る。fresh context のワーカーは disk 上の承認済みテストと設計書だけを仕様として実装するため、この余地が構造的に消える。また「設計書＋テストだけで実装できるか」は成果物の自己完結性の検証にもなる。

## 必須参照ファイル（スキル起動時に必ず読む）

1. `docs/開発プロセス/設計から実装までのフロー.md` — Phase 8 のゲート条件
2. 対象機能の設計書・実装計画書（あれば）
3. `docs/設計/<機能名>/_review/test/findings.md` — **Phase 7 の承認判定記録（またはスキップ記録）**と「Phase 8 で対応」とされた findings
4. `docs/設計/<機能名>/_review/test/red-phase-evidence.md` — Red Phase 証拠

## 重要な前提（必ず守ること）

1. **実装は fresh context の `impl-builder` が行う**
   - `impl-builder` 役割のサブエージェントを **新規エージェントとして** 起動する（起動方法は末尾「補足」参照）
   - 司令塔（メイン会話）は自分で実装コードを書かない
   - テスト・設計書はワーカーに **disk から読ませる**（会話履歴経由ではない）

2. **テストの修正は誰にも許されない**
   - ワーカーの制約として役割ファイル（`flow-agent-roles/roles/impl-builder.md`）に明記済み
   - ワーカーが「テストと設計書の矛盾」を報告してきた場合、司令塔はテストを直さず **ユーザーに報告** する。修正は人間判断のうえ Phase 5 差し戻しで行う

3. **ゲートは司令塔が独立に再検証する**
   - ワーカーの「全件 PASS」の自己申告を鵜呑みにしない
   - ワーカー完了後、司令塔自身がゲート確認コマンドを再実行して確認する

4. **Green Phase 証拠は司令塔が記録する**
   - `docs/設計/<機能名>/_review/impl/green-phase-evidence.md` に保存。これがないと Phase 9/10 に進めない

5. **前提タスクのブロック判定**
   - 設計書の前提タスク（DB スキーマ変更等）が未解消の場合、影響範囲をユーザーに報告し、実施範囲を確認 **してから** ワーカーを起動する（ワーカーは実行中にユーザーへ質問できない）

## 実行手順

### Step 1: テスト承認の確認

以下を確認する。満たされない場合は本skillを実行せず、先行フェーズの完了を案内する：

- `_review/test/findings.md` に **Phase 7 の承認判定記録**、または **Phase 7 スキップ（フロー運用設定による自動承認）の記録** があること
- Red Phase 証拠が存在すること
- Critical / Major findings が解消済みであること（承認記録または Phase 6 の収束記録で確認）

### Step 2: ワーカーへの入力の準備

- テストファイルのパス一覧を特定する（Red Phase 証拠・findings から）
- findings.md から「**Phase 8 で対応**」とされた findings を抽出し、対応リストにする
- 前提タスクのブロック・未決事項が残っていればここでユーザーに確認して解消する（ワーカー起動後は対話できない）

### Step 3: impl-builder ワーカーの起動

`impl-builder` 役割のサブエージェントを fresh context として起動する（起動方法は末尾「補足」参照）。

**プロンプトに含める内容：**

- 役割ファイル（`flow-agent-roles/roles/impl-builder.md`）の絶対パスと「最初に読み、以後その役割に完全に従う」指示
- 通すべきテストファイルの絶対パス（全件）
- 設計書・実装計画書・`AGENTS.md` の絶対パス
- 「Phase 8 で対応」findings のリスト（FIND-ID・内容・対応方針）
- 参考にすべき既存類似実装のパス（あれば）
- 前提タスクの状況（保留中のテストがあればその一覧）
- 最終応答フォーマット（役割ファイルのフォーマットに従うこと）を明記

### Step 4: ワーカー報告の受領と判断

ワーカーの最終応答を確認する：

- **完了報告の場合** → Step 5 へ
- **中断報告（テストと設計書の矛盾等）の場合** → 内容をユーザーに報告し、判断を仰ぐ。テスト修正が必要なら Phase 5 差し戻し。実装方針の確認だけで解決するなら、解消後に `impl-builder` を再起動（または SendMessage で継続）する

### Step 5: Green Phase 独立検証（司令塔の責務）

司令塔自身がゲート確認コマンドを再実行する：

```bash
npm run test              # 単体 + 結合（内部）全件 PASS
npm run test:integration  # 結合（DB込み）全件 PASS ※該当テストがある場合
npm run lint              # ESLint PASS
npm run check-types       # 型チェック PASS（作業範囲外エラーは報告のみ）
npm run build             # ビルド成功
```

期待する結果：

- **対象機能のテスト：全件 PASS**（Red Phase で FAIL していたものがすべて Green に）
- **既存テスト（リグレッション）：全件 PASS**

FAIL がある場合はワーカーの作業が不完全。findings をまとめて `impl-builder` を再起動する（テスト側は直さない）。

**検証時の注意：** テストファイルが変更されていないことを確認する（`git diff -- <テストファイルパス>` が空であること）。変更されていた場合は重大な違反として即座にユーザーへ報告する。

### Step 6: Green Phase 証拠の記録（司令塔の責務）

`docs/設計/<機能名>/_review/impl/green-phase-evidence.md` に保存：

```markdown
# Green Phase Evidence

- 機能：<機能名>
- 実施日時：<YYYY-MM-DD HH:MM>
- 実装：impl-builder（fresh context）／ゲート検証：司令塔が独立再実行

## マーカー

- target-feature-tests: PASS（N tests）
- regression-baseline: PASS（M tests）
- test-files-unchanged: 確認済（git diff なし）

## ゲート確認

| チェック | コマンド | 結果 |
|---|---|---|
| 単体 + 結合（内部） | `npm run test` | PASS（N+M tests） |
| 結合（DB込み） | `npm run test:integration` | PASS / 対象なし |
| Lint | `npm run lint` | PASS |
| 型チェック | `npm run check-types` | PASS（作業範囲外エラー：なし / 一覧参照） |
| ビルド | `npm run build` | PASS |

## Phase 7 findings の対応記録

| FIND-ID | 対応方針（Phase 7 判定） | 対応内容 | 状態 |
|---|---|---|---|
| FIND-XXX | Phase 8 で対応 | <実装内容> | 対応済 |

## 補足

- 前提タスクのブロックにより保留したテスト・実装があればその旨を明記
- ワーカーからの仮置き・未解決報告があればその内容と司令塔の判断を明記
```

### Step 7: 完了通知と次フェーズ案内

```
Phase 8（実装・Green Phase）が完了しました。

成果物:
- 実装ファイル: <パス一覧>
- Green Phase log: docs/設計/<機能名>/_review/impl/green-phase-evidence.md

ゲート確認（司令塔が独立再検証済み）:
- 対象機能テスト: N 件 PASS ／ 既存テスト: M 件 PASS
- テストファイル無変更: 確認済
- lint / check-types / build: すべて PASS

次は Phase 9（リファクタ）です。
  - 「リファクタして」 → flow-phase9-refactor skill が起動します
  - 簡単な機能で明らかに不要な場合（lean運用）はスキップ可。
    その場合は「Phase 10 に進んで」→ flow-phase10-impl-review skill が起動します
```

## 禁止事項

- **司令塔（メイン会話）が直接実装コードを書かない**（必ず `impl-builder` を fresh context で起動）
- **テストファイルを変更しない・させない**（ワーカーにも司令塔にも禁止。不備発見時は中断して人間へ）
- ワーカーの自己申告のみで Green Phase 成立と判定しない（司令塔の独立再検証必須）
- Green Phase 証拠なしで Phase 9/10 に進まない
- ワーカー起動前に解消すべき未決事項（前提タスク・仕様の曖昧さ）を残したまま起動しない

## 補足：ワーカーの起動方法（役割ファイル方式）

役割定義の正本は `flow-agent-roles/roles/impl-builder.md`（本 skill と同じ skills ディレクトリ内。使用時は絶対パスに解決する）。

**起動方法：** ツールの汎用サブエージェント起動機能で新規エージェント（fresh context）を起動し、プロンプトの冒頭で「まず役割ファイル（絶対パス）を読み、以後その役割・制約・最終応答フォーマットに完全に従うこと」を指示する。

起動できない場合はユーザーに環境設定の確認を求める。司令塔（メイン会話）が役割を代行してはならない。
