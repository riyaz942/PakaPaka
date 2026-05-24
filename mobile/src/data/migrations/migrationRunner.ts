import type { Migration, MigrationDatabase } from '@/data/migrations/migrations.types';
import type { AppError, Result } from '@/types/result.types';

function getCurrentVersion(db: MigrationDatabase): number {
  const tables = db.getAllSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
  );

  if (tables.length === 0) {
    return 0;
  }

  const row = db.getFirstSync<{ maxVersion: number | null }>(
    'SELECT MAX(version) AS maxVersion FROM schema_migrations',
  );

  return row?.maxVersion ?? 0;
}

export function runMigrations(db: MigrationDatabase, migrations: Migration[]): Result<void, AppError> {
  try {
    const currentVersion = getCurrentVersion(db);
    const pending = migrations
      .filter((migration) => migration.version > currentVersion)
      .sort((a, b) => a.version - b.version);

    for (const migration of pending) {
      db.withTransactionSync(() => {
        migration.up(db);
        db.runSync(
          'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
          migration.version,
          new Date().toISOString(),
        );
      });
    }

    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'DB_MIGRATION_ERROR',
        message: String(cause),
        cause,
      },
    };
  }
}
