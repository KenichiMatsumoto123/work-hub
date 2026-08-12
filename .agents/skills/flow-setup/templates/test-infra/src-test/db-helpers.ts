import { PrismaClient } from '@prisma/client';

/**
 * DB込み結合テスト用のPrismaクライアント。
 * テストファイルではこのインスタンスを使用し、アプリ側の prisma とは独立させる。
 */
export const testPrisma = new PrismaClient();

/**
 * 全テーブルのデータを削除する。
 * テストの beforeEach / afterAll で使用し、テスト間のデータ汚染を防ぐ。
 *
 * 外部キー制約を一時的に無効化して TRUNCATE を実行する。
 */
export async function truncateAllTables(): Promise<void> {
  const tables: Array<{ TABLE_NAME: string }> =
    await testPrisma.$queryRaw`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME NOT LIKE '_prisma_%'
    `;

  await testPrisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  for (const { TABLE_NAME } of tables) {
    await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\``);
  }
  await testPrisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
}

/**
 * テスト用の企業データを作成する。
 */
export async function createTestCompany(
  overrides: Partial<{
    code: string;
    name: string;
    is_deleted: boolean;
  }> = {},
) {
  return testPrisma.company.create({
    data: {
      code: overrides.code ?? 'TEST01',
      name: overrides.name ?? 'テスト企業',
      is_deleted: overrides.is_deleted ?? false,
    },
  });
}

/**
 * テスト用のログインアカウントを作成する。
 * パスワードは SHA-256 ハッシュ化済みの値を渡すこと。
 */
export async function createTestCompanyLogin(
  companyId: number,
  overrides: Partial<{
    name: string;
    email: string;
    password: string;
    status: number;
    login_failure_count: number;
    lock_release_at: Date | null;
    is_deleted: boolean;
  }> = {},
) {
  return testPrisma.company_login.create({
    data: {
      company_id: companyId,
      name: overrides.name ?? 'テストユーザー',
      email: overrides.email ?? 'test@example.com',
      password: overrides.password ?? '',
      status: overrides.status ?? 1,
      login_failure_count: overrides.login_failure_count ?? 0,
      lock_release_at: overrides.lock_release_at ?? null,
      is_deleted: overrides.is_deleted ?? false,
    },
  });
}
