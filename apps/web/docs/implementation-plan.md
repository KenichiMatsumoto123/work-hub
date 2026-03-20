# work-report 実装計画

> 要件・設計の詳細は [requirements.md](./requirements.md) を参照してください。

---

## 現在の状態

Phase 1 の途中まで完了。入力画面と基本的な出力タブ（日報テキスト/PJ稼働/勤怠）が TanStack Start 上で動作している。

### 完了済み

- TanStack Start + Tailwind CSS v4 プロジェクト初期化
- ユーティリティ関数の抽出（`src/lib/`）
- 入力画面コンポーネントの移植（ProjectBlock, TaskRow, ReflectionSection）
- 基本的な出力タブ（日報テキスト, PJ稼働コピー用, 勤怠コピー用）
- sessionStorage による自動保存
- localStorage によるテンプレート保存

### 未着手

- 工数管理表（月次Excelライク表）の実装
- 勤怠管理表（年間12ヶ月横並び表）の実装
- DB連携以降のすべて

---

## Phase 1: 基盤構築 + 既存機能の移植（残作業）

### 1-1. 工数管理表コンポーネントの実装

**ゴール:** プロジェクトごとの月次工数を、Excelライクな表形式で表示する

**作成ファイル:**
- `src/components/report/MonthlyTimesheetTable.tsx`

**仕様:**
- 参考様式: `(アルマコ社内用)工数管理.csv` の構造を再現
- ヘッダー部: 対象月（YYYY年MM月）、作業者名
- テーブルカラム: 日付 / 曜日 / 作業開始 / 作業終了 / 休憩 / 作業時間 / 作業内容
- その月の全日付（1日〜末日）を行として表示
- 入力済みの日は自動でデータが埋まる。未入力の日は空行
- フッター: 月の合計作業時間
- 作業開始/終了は「そのプロジェクトに費やした時間を収める枠」として自動計算（9:00起点 + 実績時間 + 休憩）
- 作業時間は自動計算（終了 - 開始 - 休憩）

**データの流れ:**
```
日報入力データ (DailyReportData[])
  → プロジェクトでフィルタ
  → 月でフィルタ
  → 表の各行にマッピング
```

**現時点ではlocalStorageに保存された日報データから表示。Phase 2でDB化。**

### 1-2. 勤怠管理表コンポーネントの実装

**ゴール:** 年間12ヶ月の勤怠を、Excelライクな横並び表で表示する

**作成ファイル:**
- `src/components/report/AttendanceTable.tsx`

**仕様:**
- 参考様式: `勤怠管理表.csv` の構造を再現
- ヘッダー部: 氏名
- 12ヶ月が横方向に並ぶ（各月のカラム: 日付 / 区分 / 始業 / 終業 / 休憩 / 勤務時間 / 遅早時間 / 残業時間 / 休出時間 / 深夜時間 / 備考）
- 区分は自動判定: 入力データがあれば「稼」、土日祝は「休」、有給等は備考欄の値から判定
- 勤務時間 = 終業 - 始業 - 休憩
- 遅早時間 = max(0, 8h - 勤務時間)（始業9:00/終業18:00/休憩1:00が基準の場合）
- 残業時間 = max(0, 勤務時間 - 8h)
- 各月のフッター: 出勤日数、合計勤務時間、合計残業時間 等

**UI考慮点:**
- 12ヶ月横並びは画面幅を超えるため、横スクロール or 月選択タブで切り替え
- 推奨: 月選択タブ（1〜12月）を上部に配置し、選択した月の表を表示。全月表示は別途対応

### 1-3. ルーティングの整理

**現状:** `src/routes/index.tsx` に入力画面と全出力が1ファイルに入っている

**変更:**
- `src/routes/index.tsx` → 入力 + 日報テキスト出力（現状維持、Phase 2でルート分割）
- 工数管理表ページ: `src/routes/timesheet.tsx`（月選択 + プロジェクト選択 → 表表示）
- 勤怠管理表ページ: `src/routes/attendance.tsx`（月選択 → 表表示）

**ナビゲーション:**
- ヘッダーまたはサイドバーに「日報入力」「工数管理」「勤怠管理」のリンクを追加

### 1-4. データの一時永続化（localStorage）

**Phase 2のDB化までの暫定措置。**

- 日報保存ボタンを追加（入力画面下部）
- 保存時、`localStorage` の `daily-reports` キーに日付をキーとしたオブジェクトを保存
- 工数管理表・勤怠管理表はこのデータを読み取って表示

```typescript
// localStorage のデータ構造
interface StoredReports {
  [date: string]: DailyReportData  // "2026-03-18": { ... }
}
```

---

## Phase 2: DB + 日報の永続化

### 前提

- PostgreSQL の接続先が必要（ローカル or Neon/Supabase/Railway 等のマネージドサービス）
- `.env` に `DATABASE_URL` を設定

### 2-1. Drizzle ORM セットアップ

**インストール:**
```bash
npm i drizzle-orm postgres
npm i -D drizzle-kit
```

**作成ファイル:**
- `drizzle.config.ts` — Drizzle Kit 設定
- `src/server/db.ts` — DB接続の初期化
- `src/server/schema.ts` — 全テーブルのスキーマ定義

**スキーマ定義（Phase 2 で作るテーブル）:**
- `daily_reports` — 日報本体
- `report_entries` — 日報の各タスク行

> `users`, `teams`, `team_members`, `projects`, `task_templates` は後のフェーズで追加

### 2-2. マイグレーション

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

### 2-3. Server Functions の実装

**作成ファイル:**
- `src/server/functions/reports.ts`

**実装する関数:**

| 関数名 | 用途 |
|--------|------|
| `saveReport(data: DailyReportData)` | 日報の保存（upsert: 同一日付なら更新） |
| `getReport(date: string)` | 特定日付の日報を取得 |
| `getReportsByMonth(year: number, month: number)` | 月単位で日報一覧を取得 |
| `getReportsByDateRange(from: string, to: string)` | 日付範囲で取得 |
| `searchReports(query: string)` | キーワード検索（タスク名・作業内容） |
| `deleteReport(date: string)` | 日報の削除 |

### 2-4. 画面の接続

- 入力画面の「保存」ボタン → `saveReport` を呼び出し
- 工数管理表 → `getReportsByMonth` で月のデータを取得
- 勤怠管理表 → `getReportsByMonth` で月のデータを取得
- 日報一覧ページ (`/reports`) の新規作成 — リスト表示 + 検索フォーム

### 2-5. ルーティング更新

```
/reports         → 日報一覧・検索
/reports/new     → 日報入力（新規）
/reports/$date   → 日報 表示/編集
```

---

## Phase 3: 認証

### 3-1. Better Auth セットアップ

**インストール:**
```bash
npm i better-auth
```

**作成ファイル:**
- `src/server/auth.ts` — Better Auth の設定・初期化
- `src/routes/api/auth.$.ts` — Better Auth のキャッチオールAPIルート
- `src/routes/login.tsx` — ログインページ
- `src/routes/register.tsx` — ユーザー登録ページ
- `src/routes/_authed.tsx` — 認証済みレイアウトルート（`beforeLoad` で認証チェック）

**作業:**
1. Better Auth を初期化し、メール+パスワード認証を設定
2. DB に `users` テーブルを追加（Better Auth の自動生成 + カスタムフィールド）
3. `/login`, `/register` ページを実装
4. `_authed.tsx` で `beforeLoad` による認証チェックを実装
5. 既存の Server Functions に認証 middleware を追加
6. `daily_reports` に `user_id` カラムを追加し、ユーザーに紐付け
7. 既存ルートを `/_authed/` 配下に移動

---

## Phase 4: マスタ管理

### 4-1. DB テーブル追加

- `projects` テーブル（チームに紐付くプロジェクトマスタ）
- `task_templates` テーブル（プロジェクトに紐付くタスクテンプレート）

### 4-2. Server Functions

**作成ファイル:**
- `src/server/functions/projects.ts`

| 関数名 | 用途 |
|--------|------|
| `listProjects()` | プロジェクト一覧取得 |
| `createProject(name)` | プロジェクト作成 |
| `updateProject(id, data)` | プロジェクト更新 |
| `archiveProject(id)` | プロジェクトアーカイブ |
| `listTaskTemplates(projectId)` | タスクテンプレート一覧 |
| `createTaskTemplate(projectId, data)` | タスクテンプレート作成 |
| `updateTaskTemplate(id, data)` | タスクテンプレート更新 |
| `archiveTaskTemplate(id)` | タスクテンプレートアーカイブ |

### 4-3. 画面

- `/_authed/master/projects` — プロジェクト一覧（CRUD）
- `/_authed/master/projects/$projectId` — プロジェクト詳細 + タスクテンプレート管理
- 日報入力画面にプロジェクト選択ドロップダウン追加（マスタから選択 → タスクテンプレートが自動展開）

### 4-4. report_entries との紐付け

- `report_entries.project_id` にマスタの `projects.id` を格納
- `project_name`, `task_label` は非正規化で保持（過去データの整合性担保）

---

## Phase 5: チーム機能

### 5-1. DB テーブル追加

- `teams` テーブル
- `team_members` テーブル

### 5-2. Server Functions

**作成ファイル:**
- `src/server/functions/teams.ts`

| 関数名 | 用途 |
|--------|------|
| `createTeam(name)` | チーム作成 |
| `inviteMember(teamId, email)` | メンバー招待 |
| `removeMember(teamId, userId)` | メンバー削除 |
| `listTeamMembers(teamId)` | メンバー一覧 |
| `getTeamReports(teamId, date)` | チームの日報一覧（特定日） |
| `getTeamReportsByMonth(teamId, year, month)` | チームの月次日報 |

### 5-3. 画面

- `/_authed/team` — チーム管理（メンバー一覧・招待）
- `/_authed/team/reports` — チームメンバーの日報閲覧（日付・メンバー選択）
- `/_authed/team/reports/$userId/$date` — 特定メンバーの特定日報
- `/_authed/dashboard` — 今日のチーム提出状況サマリー

### 5-4. マスタのチーム紐付け

- `projects.team_id` でプロジェクトマスタをチーム単位に
- チームメンバー全員が同じマスタを共有

---

## Phase 6: 品質向上・デプロイ

### 6-1. UI/UX 改善

- レスポンシブ対応（モバイル表示）
- ローディング状態（Skeleton UI）
- エラーバウンダリ（`ErrorBoundary`, Not Found ページ）
- トースト通知（保存成功/失敗）

### 6-2. バリデーション

- Zod スキーマ定義（`src/lib/validators.ts`）
- Server Functions の入力バリデーション
- フォームのクライアントサイドバリデーション

### 6-3. テスト

- ユーティリティ関数のユニットテスト（`time-utils.ts`, `report-generator.ts`）
- Server Functions の結合テスト

### 6-4. デプロイ

| 候補 | 特徴 |
|------|------|
| Vercel | TanStack Start 対応、無料枠あり |
| Railway | PostgreSQL 一体型、シンプル |
| Cloudflare Workers | エッジ実行、低コスト |

- `.env` の本番設定（`DATABASE_URL`, `SESSION_SECRET` 等）
- CI/CD（GitHub Actions でビルド + デプロイ）

---

## 補足: 既存コードの移植マッピング

| 移植元（HTML） | 移植先（TanStack Start） | 状態 |
|----------------|--------------------------|------|
| `generateDailyReport()` | `src/lib/report-generator.ts` | ✅ 完了 |
| `generateAttendanceReport()` | `src/lib/report-generator.ts` | ✅ 完了 |
| `parseTime()`, `formatHours()` | `src/lib/time-utils.ts` | ✅ 完了 |
| `theme` オブジェクト | `src/styles/app.css`（CSS変数） | ✅ 完了 |
| `ProjectBlock` | `src/components/report/ProjectBlock.tsx` | ✅ 完了 |
| `TaskRow` | `src/components/report/TaskRow.tsx` | ✅ 完了 |
| `ReflectionSection` | `src/components/report/ReflectionSection.tsx` | ✅ 完了 |
| `OutputPanel`, `CellRow` | `src/components/ui/CellRow.tsx` + ルート内 | ✅ 完了 |
| `CopyButton` | `src/components/ui/CopyButton.tsx` | ✅ 完了 |
| `localStorage` / `sessionStorage` | `src/lib/storage.ts` | ✅ 完了 |
| 工数管理表（Excelライク） | `src/components/report/MonthlyTimesheetTable.tsx` | ❌ 未着手 |
| 勤怠管理表（Excelライク） | `src/components/report/AttendanceTable.tsx` | ❌ 未着手 |

---

## 開発環境の起動方法

```bash
cd C:\Users\matsu\ドキュメント\arumako\work-report
npm run dev
# http://localhost:3000 (or 3001 if 3000 is in use)
```
