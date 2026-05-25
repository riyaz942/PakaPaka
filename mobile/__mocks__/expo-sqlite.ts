type Row = Record<string, unknown>;

type MockDatabaseState = {
  tables: Map<string, Row[]>;
  inTransaction: boolean;
};

const databases = new Map<string, MockDatabaseState>();
const importedAssets = new Map<number, string>();

function getDatabaseState(databaseName: string): MockDatabaseState {
  const existing = databases.get(databaseName);
  if (existing) {
    return existing;
  }

  const created: MockDatabaseState = {
    tables: new Map(),
    inTransaction: false,
  };
  databases.set(databaseName, created);
  return created;
}

function parseCreateTable(sql: string): string | null {
  const match = sql.match(/CREATE TABLE(?: IF NOT EXISTS)?\s+([a-zA-Z0-9_]+)/i);
  return match?.[1] ?? null;
}

function parseInsert(sql: string): { table: string; columns: string[]; values: unknown[] } | null {
  const match = sql.match(
    /INSERT INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
  );
  if (!match) {
    return null;
  }

  const table = match[1];
  const columns = match[2].split(',').map((column) => column.trim());
  const values = match[3].split(',').map((value) => {
    const trimmed = value.trim();
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1);
    }
    if (trimmed === 'NULL') {
      return null;
    }
    return Number(trimmed);
  });

  return { table, columns, values };
}

function applySql(state: MockDatabaseState, sql: string, params: unknown[] = []): void {
  const trimmed = sql.trim();

  if (/^BEGIN/i.test(trimmed)) {
    state.inTransaction = true;
    return;
  }

  if (/^COMMIT/i.test(trimmed)) {
    state.inTransaction = false;
    return;
  }

  if (/^ROLLBACK/i.test(trimmed)) {
    state.inTransaction = false;
    return;
  }

  const createTable = parseCreateTable(trimmed);
  if (createTable) {
    if (!state.tables.has(createTable)) {
      state.tables.set(createTable, []);
    }
    return;
  }

  const insert = parseInsert(trimmed);
  if (insert && !trimmed.includes('?')) {
    const rows = state.tables.get(insert.table) ?? [];
    const row: Row = {};
    insert.columns.forEach((column, index) => {
      row[column] = insert.values[index];
    });
    rows.push(row);
    state.tables.set(insert.table, rows);
    return;
  }

  if (/^INSERT INTO schema_migrations/i.test(trimmed)) {
    const rows = state.tables.get('schema_migrations') ?? [];
    rows.push({
      version: params[0],
      applied_at: params[1],
    });
    state.tables.set('schema_migrations', rows);
    return;
  }

  if (/^INSERT INTO user_preferences/i.test(trimmed) && trimmed.includes('?')) {
    const rows = state.tables.get('user_preferences') ?? [];
    rows.push({
      key: params[0],
      value: params[1],
      updated_at: params[2],
    });
    state.tables.set('user_preferences', rows);
    return;
  }
}

function queryRows(state: MockDatabaseState, sql: string, params: unknown[] = []): Row[] {
  const trimmed = sql.trim();

  if (/FROM sqlite_master/i.test(trimmed)) {
    const names = Array.from(state.tables.keys());
    if (/name = \?/i.test(trimmed)) {
      const tableName = String(params[0]);
      return names.includes(tableName) ? [{ name: tableName }] : [];
    }
    if (/name = 'schema_migrations'/i.test(trimmed)) {
      return names.includes('schema_migrations') ? [{ name: 'schema_migrations' }] : [];
    }
    if (/name = 'user_preferences'/i.test(trimmed)) {
      return names.includes('user_preferences') ? [{ name: 'user_preferences' }] : [];
    }
    return names.map((name) => ({ name }));
  }

  if (/COUNT\(\*\)/i.test(trimmed) && /schema_migrations/i.test(trimmed)) {
    const rows = state.tables.get('schema_migrations') ?? [];
    return [{ count: rows.length }];
  }

  if (/MAX\(version\)/i.test(trimmed)) {
    const rows = state.tables.get('schema_migrations') ?? [];
    const maxVersion = rows.reduce<number>((max, row) => {
      const version = Number(row.version ?? 0);
      return version > max ? version : max;
    }, 0);
    return [{ maxVersion: maxVersion || null }];
  }

  if (/FROM schema_migrations/i.test(trimmed)) {
    return [...(state.tables.get('schema_migrations') ?? [])];
  }

  if (/FROM curriculum_metadata/i.test(trimmed)) {
    return [...(state.tables.get('curriculum_metadata') ?? [])];
  }

  if (/FROM user_preferences/i.test(trimmed)) {
    const rows = state.tables.get('user_preferences') ?? [];
    if (/WHERE key = \?/i.test(trimmed)) {
      return rows.filter((row) => row.key === params[0]);
    }
    return [...rows];
  }

  return [];
}

class MockSQLiteDatabase {
  constructor(private readonly databaseName: string) {}

  execSync(source: string): void {
    const state = getDatabaseState(this.databaseName);
    source
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
      .forEach((statement) => applySql(state, statement));
  }

  async execAsync(source: string): Promise<void> {
    this.execSync(source);
  }

  runSync(source: string, ...params: unknown[]) {
    applySql(getDatabaseState(this.databaseName), source, params);
    return { changes: 1, lastInsertRowId: 1 };
  }

  getAllSync<T>(source: string, ...params: unknown[]): T[] {
    if (/sqlite_master/i.test(source) && /name = \?/i.test(source)) {
      const tableName = params[0];
      const state = getDatabaseState(this.databaseName);
      const exists = state.tables.has(String(tableName));
      return exists ? ([{ name: tableName }] as T[]) : [];
    }

    return queryRows(getDatabaseState(this.databaseName), source, params) as T[];
  }

  getFirstSync<T>(source: string, ...params: unknown[]): T | null {
    const rows = this.getAllSync<T>(source, ...params);
    return rows[0] ?? null;
  }

  withTransactionSync(task: () => void): void {
    const state = getDatabaseState(this.databaseName);
    state.inTransaction = true;
    try {
      task();
    } finally {
      state.inTransaction = false;
    }
  }

  async closeAsync(): Promise<void> {
    return;
  }
}

export async function openDatabaseAsync(databaseName: string) {
  return new MockSQLiteDatabase(databaseName);
}

export async function importDatabaseFromAssetAsync(
  databaseName: string,
  assetSource: { assetId: number; forceOverwrite?: boolean },
) {
  importedAssets.set(assetSource.assetId, databaseName);

  const state = getDatabaseState(databaseName);
  state.tables.set('curriculum_metadata', [
    {
      version: '1.0.0-n5-seed',
      build_date: '2026-05-25T00:00:00.000Z',
      content_hash: 'mock-content-hash',
      item_count: 114,
      radical_count: 25,
      kanji_count: 32,
      vocabulary_count: 41,
      grammar_count: 16,
    },
  ]);
}

export function __mockResetSqlite() {
  databases.clear();
  importedAssets.clear();
}

export function __mockGetImportedAssetDatabase(assetId: number) {
  return importedAssets.get(assetId);
}

export type SQLiteDatabase = MockSQLiteDatabase;
