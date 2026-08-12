/**
 * E2E で使うシードユーザー（auth.setup.ts が作成してログイン済みの storageState を書き出す）
 *
 * ログアウトを試すテストは、そのセッションを実際に失効させてしまう。
 * 他のテストのログイン状態を巻き添えにしないよう、専用のユーザーを分けている。
 */
export type E2EUser = {
  email: string
  name: string
  /** ログイン済みクッキーの保存先 */
  storageState: string
}

/** 通常のテスト（ログイン済みが前提）が共有するユーザー */
export const E2E_USER: E2EUser = {
  email: 'e2e@example.com',
  name: 'E2E ユーザー',
  storageState: 'playwright/.auth/user.json',
}

/** ログアウトのテスト専用ユーザー（セッションを失効させるため共有しない） */
export const E2E_LOGOUT_USER: E2EUser = {
  email: 'e2e-logout@example.com',
  name: 'E2E ログアウト用ユーザー',
  storageState: 'playwright/.auth/logout-user.json',
}

export const E2E_USERS: E2EUser[] = [E2E_USER, E2E_LOGOUT_USER]
