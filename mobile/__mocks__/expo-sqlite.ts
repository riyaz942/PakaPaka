type Row = Record<string, unknown>;

type MockDatabaseState = {
  tables: Map<string, Row[]>;
  inTransaction: boolean;
  transactionSnapshot: Map<string, Row[]> | null;
};

const databases = new Map<string, MockDatabaseState>();
const importedAssets = new Map<number, string>();

const SEED_METADATA: Row = {
  version: '1.0.0-n5-seed',
  build_date: '2026-05-25T00:00:00.000Z',
  content_hash: 'mock-content-hash',
  item_count: 114,
  radical_count: 25,
  kanji_count: 32,
  vocabulary_count: 41,
  grammar_count: 16,
};

const DOWNLOAD_METADATA: Row = {
  version: '1.0.1-n5-seed-mock',
  build_date: '2026-06-01T00:00:00.000Z',
  content_hash: '7cd5775ec3adfb962f406348983f5f72d81224602c1dad34ecc47d2568724c20',
  item_count: 114,
  radical_count: 25,
  kanji_count: 32,
  vocabulary_count: 41,
  grammar_count: 16,
};

function getDatabaseState(databaseName: string): MockDatabaseState {
  const existing = databases.get(databaseName);
  if (existing) {
    return existing;
  }

  const created: MockDatabaseState = {
    tables: new Map(),
    inTransaction: false,
    transactionSnapshot: null,
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

function upsertStudyStatus(
  state: MockDatabaseState,
  itemId: unknown,
  status: unknown,
  updatedAt: unknown,
) {
  const rows = state.tables.get('item_study_status') ?? [];
  const existingIndex = rows.findIndex((row) => row.item_id === itemId);
  const nextRow = { item_id: itemId, status, updated_at: updatedAt };
  if (existingIndex >= 0) {
    rows[existingIndex] = nextRow;
  } else {
    rows.push(nextRow);
  }
  state.tables.set('item_study_status', rows);
}

function cloneTableRows(rows: Row[] | undefined): Row[] {
  return (rows ?? []).map((row) => ({ ...row }));
}

function snapshotTables(state: MockDatabaseState, tableNames: string[]): Map<string, Row[]> {
  const snapshot = new Map<string, Row[]>();
  for (const tableName of tableNames) {
    snapshot.set(tableName, cloneTableRows(state.tables.get(tableName)));
  }
  return snapshot;
}

function restoreTables(state: MockDatabaseState, snapshot: Map<string, Row[]>): void {
  for (const [tableName, rows] of snapshot.entries()) {
    state.tables.set(tableName, cloneTableRows(rows));
  }
}

function upsertSrsState(
  state: MockDatabaseState,
  params: unknown[],
) {
  const [
    itemId,
    stability,
    difficulty,
    dueDate,
    fsrsState,
    reps,
    lapses,
    isBurned,
    srsStageLabel,
    updatedAt,
  ] = params;

  const rows = state.tables.get('srs_states') ?? [];
  const nextRow = {
    item_id: itemId,
    stability,
    difficulty,
    due_date: dueDate,
    fsrs_state: fsrsState,
    reps,
    lapses,
    is_burned: isBurned,
    srs_stage_label: srsStageLabel,
    updated_at: updatedAt,
  };
  const existingIndex = rows.findIndex((row) => row.item_id === itemId);
  if (existingIndex >= 0) {
    rows[existingIndex] = nextRow;
  } else {
    rows.push(nextRow);
  }
  state.tables.set('srs_states', rows);
}

function insertImportMetadata(state: MockDatabaseState, params: unknown[]) {
  const rows = state.tables.get('import_metadata') ?? [];
  rows.push({
    id: rows.length + 1,
    source: params[0],
    imported_at: params[1],
    mapped_count: params[2],
    unmatched_count: params[3],
  });
  state.tables.set('import_metadata', rows);
}

function upsertPreference(state: MockDatabaseState, key: unknown, value: unknown, updatedAt: unknown) {
  const rows = state.tables.get('user_preferences') ?? [];
  const existingIndex = rows.findIndex((row) => row.key === key);
  const nextRow = { key, value, updated_at: updatedAt };
  if (existingIndex >= 0) {
    rows[existingIndex] = nextRow;
  } else {
    rows.push(nextRow);
  }
  state.tables.set('user_preferences', rows);
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

  if (/^INSERT INTO user_preferences/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    upsertPreference(state, params[0], params[1], params[2]);
    return;
  }

  if (/^INSERT INTO user_preferences/i.test(trimmed) && trimmed.includes('?')) {
    upsertPreference(state, params[0], params[1], params[2]);
    return;
  }

  if (/^INSERT INTO item_study_status/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    upsertStudyStatus(state, params[0], params[1], params[2]);
    return;
  }

  if (/^INSERT INTO srs_states/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    upsertSrsState(state, params);
    return;
  }

  if (/^INSERT INTO import_metadata/i.test(trimmed)) {
    insertImportMetadata(state, params);
    return;
  }

  if (/^INSERT INTO external_id_mappings/i.test(trimmed) && trimmed.includes('?')) {
    const rows = state.tables.get('external_id_mappings') ?? [];
    rows.push({
      source: params[0],
      external_id: params[1],
      item_id: params[2],
    });
    state.tables.set('external_id_mappings', rows);
    return;
  }

  if (/^DELETE FROM item_study_status/i.test(trimmed)) {
    const rows = state.tables.get('item_study_status') ?? [];
    state.tables.set(
      'item_study_status',
      rows.filter((row) => row.item_id !== params[0]),
    );
    return;
  }

  if (/^DELETE FROM user_preferences/i.test(trimmed)) {
    const rows = state.tables.get('user_preferences') ?? [];
    state.tables.set(
      'user_preferences',
      rows.filter((row) => row.key !== params[0]),
    );
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
    if (/name = 'item_study_status'/i.test(trimmed)) {
      return names.includes('item_study_status') ? [{ name: 'item_study_status' }] : [];
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

  if (/FROM item_study_status/i.test(trimmed)) {
    let rows = [...(state.tables.get('item_study_status') ?? [])];

    if (/WHERE item_id = \?/i.test(trimmed)) {
      return rows.filter((row) => row.item_id === params[0]);
    }

    if (/WHERE item_id IN/i.test(trimmed)) {
      const allowedIds = new Set(params);
      return rows.filter((row) => allowedIds.has(row.item_id));
    }

    return rows;
  }

  if (/FROM srs_states/i.test(trimmed)) {
    const rows = state.tables.get('srs_states') ?? [];
    if (/COUNT\(\*\)/i.test(trimmed)) {
      return [{ count: rows.length }];
    }
    return [...rows];
  }

  if (/FROM import_metadata/i.test(trimmed)) {
    const rows = state.tables.get('import_metadata') ?? [];
    if (/COUNT\(\*\)/i.test(trimmed)) {
      return [{ count: rows.length }];
    }
    return [...rows];
  }

  if (/FROM external_id_mappings/i.test(trimmed)) {
    let rows = [...(state.tables.get('external_id_mappings') ?? [])];
    if (/source = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.source === params[0]);
      const externalIds = params.slice(1);
      if (/external_id IN/i.test(trimmed) && externalIds.length > 0) {
        const allowed = new Set(externalIds.map(String));
        rows = rows.filter((row) => allowed.has(String(row.external_id)));
      }
    }
    return rows;
  }

  if (/FROM item_relationships/i.test(trimmed) && /JOIN items/i.test(trimmed)) {
    const relationships = [...(state.tables.get('item_relationships') ?? [])];
    const items = state.tables.get('items') ?? [];

    const childIds = /child_item_id IN/i.test(trimmed)
      ? new Set(params)
      : new Set([params[0]]);

    return relationships
      .filter(
        (relationship) =>
          childIds.has(relationship.child_item_id) &&
          relationship.relationship_type === 'requires',
      )
      .map((relationship) => {
        const parent = items.find((item) => item.id === relationship.parent_item_id);
        return {
          child_item_id: relationship.child_item_id,
          primary_form: parent?.primary_form ?? '',
          meaning: parent?.meaning ?? '',
          sort_order: parent?.sort_order ?? 0,
        };
      })
      .sort((left, right) => {
        const childCompare = Number(left.child_item_id) - Number(right.child_item_id);
        if (childCompare !== 0) {
          return childCompare;
        }
        return Number(left.sort_order) - Number(right.sort_order);
      });
  }

  if (/FROM items/i.test(trimmed)) {
    let rows = [...(state.tables.get('items') ?? [])];

    if (/item_type = 'radical'/i.test(trimmed) && /jlpt_level = \?/i.test(trimmed)) {
      rows = rows.filter(
        (row) => row.item_type === 'radical' && row.jlpt_level === params[0],
      );
    } else if (/item_type = \?/i.test(trimmed) && /jlpt_level = \?/i.test(trimmed)) {
      rows = rows.filter(
        (row) => row.item_type === params[0] && row.jlpt_level === params[1],
      );
    } else if (/jlpt_level = \?/i.test(trimmed) && !/item_type = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.jlpt_level === params[0]);
    }

    if (/COUNT\(\*\)/i.test(trimmed)) {
      if (/GROUP BY item_type/i.test(trimmed)) {
        const counts = new Map<string, number>();
        for (const row of rows) {
          const itemType = String(row.item_type);
          counts.set(itemType, (counts.get(itemType) ?? 0) + 1);
        }
        return Array.from(counts.entries()).map(([item_type, count]) => ({
          item_type,
          count,
        }));
      }
      return [{ count: rows.length }];
    }

    if (/ORDER BY sort_order ASC/i.test(trimmed)) {
      rows.sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
    }

    return rows;
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
    const snapshot = snapshotTables(state, [
      'srs_states',
      'import_metadata',
      'item_study_status',
    ]);
    state.inTransaction = true;
    try {
      task();
    } catch (error) {
      restoreTables(state, snapshot);
      throw error;
    } finally {
      state.inTransaction = false;
    }
  }

  async closeAsync(): Promise<void> {
    return;
  }
}

export async function openDatabaseAsync(databaseName: string) {
  if (databaseName === 'curriculum.db.download') {
    const state = getDatabaseState(databaseName);
    state.tables.set('curriculum_metadata', [{ ...DOWNLOAD_METADATA }]);
  }

  return new MockSQLiteDatabase(databaseName);
}

export async function importDatabaseFromAssetAsync(
  databaseName: string,
  assetSource: { assetId: number; forceOverwrite?: boolean },
) {
  importedAssets.set(assetSource.assetId, databaseName);

  const state = getDatabaseState(databaseName);
  state.tables.set('curriculum_metadata', [{ ...SEED_METADATA }]);
}

export function __mockApplyDownloadedCurriculumToActive() {
  const state = getDatabaseState('curriculum.db');
  state.tables.set('curriculum_metadata', [{ ...DOWNLOAD_METADATA }]);
  databases.delete('curriculum.db.download');
}

export function __mockSetItems(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('items', rows.map((row) => ({ ...row })));
}

export function __mockSetItemRelationships(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('item_relationships', rows.map((row) => ({ ...row })));
}

export function __mockSetExternalIdMappings(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('external_id_mappings', rows.map((row) => ({ ...row })));
}

export function __mockResetSqlite() {
  databases.clear();
  importedAssets.clear();
}

export function __mockClearImportedAssets() {
  importedAssets.clear();
}

export function __mockGetImportedAssetDatabase(assetId: number) {
  return importedAssets.get(assetId);
}

export function __mockGetImportedAssetCount() {
  return importedAssets.size;
}

export type SQLiteDatabase = MockSQLiteDatabase;
