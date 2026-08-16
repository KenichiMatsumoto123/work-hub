# 401 未認証エラー実形状（AC-L44）

- 機能：日報の自動読み込み
- 記録日：2026-08-16
- 根拠：`apps/web/src/server/middleware/require-session.ts`

## requireSession が投げる形状

未認証（`auth.api.getSession` が `null`）のとき、ミドルウェアは次を **throw** する：

```ts
throw new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
  status: 401,
  headers: { 'content-type': 'application/json' },
})
```

### AC-L44 列挙との対応

| 列挙 | 該当 | 判定根拠 |
|---|---|---|
| (a) `Response` かつ `status === 401` | **該当** | 上記 `throw new Response(..., { status: 401 })` |
| (b) `status === 401` を持つオブジェクト | **該当** | `Response` 自体が `status === 401` を持つ |
| (c) `message` に `'UNAUTHORIZED'` を含む | **該当（間接）** | ボディ JSON `{ error: 'UNAUTHORIZED' }`。クライアント側で `Error` にラップされた場合、`message` に `UNAUTHORIZED` が含まれる経路が想定される |

## クライアント到達形状（推定・未実呼び出し）

Phase 5 時点では `getReportByDateFn` の未認証実呼び出しは未実施（スタブ段階）。
`createServerFn` + `requireSession` 経由の既存パターン（`saveReportFn` 等）と同一ミドルウェアのため、
上記 `Response` がクライアントに伝播し、フレームワークが `Error` 等にラップする場合は
ネストした `cause` / `error` / `response` 経由で (a)(b)(c) のいずれかが true になる想定。

## 設計書追記の要否

**不要。** AC-L44 の (a)(b)(c) で `requireSession` の実形状を網羅できる。
