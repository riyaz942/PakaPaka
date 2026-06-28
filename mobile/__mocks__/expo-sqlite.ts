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

function upsertPassagePracticeResult(
  state: MockDatabaseState,
  params: unknown[],
) {
  const [passageId, questionId, isCorrect, userAnswer, answeredAt] = params;
  const rows = state.tables.get('passage_practice_results') ?? [];
  const existingIndex = rows.findIndex(
    (row) => row.passage_id === passageId && row.question_id === questionId,
  );
  const nextRow = {
    passage_id: passageId,
    question_id: questionId,
    is_correct: isCorrect,
    user_answer: userAnswer,
    answered_at: answeredAt,
  };
  if (existingIndex >= 0) {
    rows[existingIndex] = nextRow;
  } else {
    rows.push(nextRow);
  }
  state.tables.set('passage_practice_results', rows);
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

  if (/^INSERT OR IGNORE INTO srs_states/i.test(trimmed)) {
    const rows = state.tables.get('srs_states') ?? [];
    const exists = rows.some((row) => row.item_id === params[0]);
    if (!exists) {
      upsertSrsState(state, params);
    }
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

  if (/^DELETE FROM personal_mnemonics/i.test(trimmed)) {
    const rows = state.tables.get('personal_mnemonics') ?? [];
    state.tables.set(
      'personal_mnemonics',
      rows.filter((row) => row.item_id !== params[0]),
    );
    return;
  }

  if (/^INSERT INTO passage_practice_results/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    upsertPassagePracticeResult(state, params);
    return;
  }

  if (/^INSERT INTO personal_mnemonics/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    const [itemId, mnemonicText, updatedAt] = params;
    const rows = state.tables.get('personal_mnemonics') ?? [];
    const idx = rows.findIndex((row) => row.item_id === itemId);
    const next = { item_id: itemId, mnemonic_text: mnemonicText, updated_at: updatedAt };
    if (idx >= 0) rows[idx] = next;
    else rows.push(next);
    state.tables.set('personal_mnemonics', rows);
    return;
  }

  if (/^INSERT INTO related_item_boosts/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    const [itemId, boost, updatedAt] = params;
    const rows = state.tables.get('related_item_boosts') ?? [];
    const idx = rows.findIndex((row) => row.item_id === itemId);
    const next = { item_id: itemId, boost, updated_at: updatedAt };
    if (idx >= 0) rows[idx] = next;
    else rows.push(next);
    state.tables.set('related_item_boosts', rows);
    return;
  }

  if (/^DELETE FROM related_item_boosts/i.test(trimmed)) {
    const rows = state.tables.get('related_item_boosts') ?? [];
    if (/IN \(/i.test(trimmed)) {
      const ids = new Set(params);
      state.tables.set(
        'related_item_boosts',
        rows.filter((row) => !ids.has(row.item_id)),
      );
    } else {
      state.tables.set(
        'related_item_boosts',
        rows.filter((row) => row.item_id !== params[0]),
      );
    }
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

    if (/WHERE status = \?/i.test(trimmed)) {
      return rows.filter((row) => row.status === params[0]);
    }

    return rows;
  }

  if (/FROM srs_states/i.test(trimmed)) {
    let rows = [...(state.tables.get('srs_states') ?? [])];
    if (/COUNT\(\*\)/i.test(trimmed)) {
      return [{ count: rows.length }];
    }
    if (/WHERE item_id = \?/i.test(trimmed)) {
      return rows.filter((row) => row.item_id === params[0]);
    }
    if (/WHERE due_date <= \? AND is_burned = 0/i.test(trimmed)) {
      const nowIso = String(params[0]);
      const limit = params[1] !== undefined ? Number(params[1]) : rows.length;
      rows = rows
        .filter((row) => String(row.due_date) <= nowIso && row.is_burned === 0)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
        .slice(0, limit);
      return rows;
    }
    return rows;
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

  if (/FROM grammar_vocabulary_links/i.test(trimmed) && /JOIN items/i.test(trimmed)) {
    const links = [...(state.tables.get('grammar_vocabulary_links') ?? [])];
    const items = state.tables.get('items') ?? [];

    return links
      .filter((link) => link.vocabulary_item_id === params[0])
      .map((link) => {
        const grammarItem = items.find((item) => item.id === link.grammar_item_id);
        return {
          grammar_item_id: link.grammar_item_id,
          vocabulary_item_id: link.vocabulary_item_id,
          primary_form: grammarItem?.primary_form ?? '',
          meaning: grammarItem?.meaning ?? '',
        };
      })
      .sort((left, right) => {
        const leftItem = items.find((item) => item.id === left.grammar_item_id);
        const rightItem = items.find((item) => item.id === right.grammar_item_id);
        return Number(leftItem?.sort_order ?? 0) - Number(rightItem?.sort_order ?? 0);
      });
  }

  if (/FROM example_sentences/i.test(trimmed)) {
    let rows = [...(state.tables.get('example_sentences') ?? [])];
    if (/WHERE item_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.item_id === params[0]);
    }
    if (/ORDER BY sort_order ASC/i.test(trimmed)) {
      rows.sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
    }
    return rows;
  }

  if (/FROM grammar_rules/i.test(trimmed)) {
    const rows = state.tables.get('grammar_rules') ?? [];
    if (/WHERE item_id = \?/i.test(trimmed)) {
      return rows.filter((row) => row.item_id === params[0]);
    }
    return [...rows];
  }

  if (/FROM accepted_answers/i.test(trimmed)) {
    let rows = [...(state.tables.get('accepted_answers') ?? [])];
    if (/WHERE item_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.item_id === params[0]);
    }
    if (/ORDER BY is_primary DESC/i.test(trimmed)) {
      rows.sort((left, right) => {
        const primaryCompare = Number(right.is_primary) - Number(left.is_primary);
        if (primaryCompare !== 0) {
          return primaryCompare;
        }
        return Number(left.id) - Number(right.id);
      });
    }
    return rows;
  }

  if (/FROM kanji_readings/i.test(trimmed)) {
    let rows = [...(state.tables.get('kanji_readings') ?? [])];
    if (/WHERE item_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.item_id === params[0]);
    }
    if (/ORDER BY sort_order ASC/i.test(trimmed)) {
      rows.sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
    }
    return rows;
  }

  if (/FROM item_relationships/i.test(trimmed) && /JOIN items/i.test(trimmed)) {
    const relationships = [...(state.tables.get('item_relationships') ?? [])];
    const items = state.tables.get('items') ?? [];

    if (/parent_item_id IN/i.test(trimmed)) {
      const parentIds = new Set(params);
      const allowedTypes = new Set(['builds_on', 'reinforces', 'requires']);

      return relationships
        .filter(
          (relationship) =>
            parentIds.has(relationship.parent_item_id) &&
            allowedTypes.has(String(relationship.relationship_type)),
        )
        .map((relationship) => {
          const child = items.find((item) => item.id === relationship.child_item_id);
          return {
            parent_item_id: relationship.parent_item_id,
            id: child?.id,
            primary_form: child?.primary_form ?? '',
            meaning: child?.meaning ?? '',
            item_type: child?.item_type,
            relationship_type: relationship.relationship_type,
            sort_order: child?.sort_order ?? 0,
          };
        })
        .sort((left, right) => {
          const parentCompare = Number(left.parent_item_id) - Number(right.parent_item_id);
          if (parentCompare !== 0) {
            return parentCompare;
          }
          return Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
        });
    }

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
          id: parent?.id,
          primary_form: parent?.primary_form ?? '',
          meaning: parent?.meaning ?? '',
          item_type: parent?.item_type,
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

  if (/FROM passage_practice_results/i.test(trimmed)) {
    let rows = [...(state.tables.get('passage_practice_results') ?? [])];
    if (/WHERE passage_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.passage_id === params[0]);
    }
    return rows;
  }

  if (/FROM personal_mnemonics/i.test(trimmed)) {
    let rows = [...(state.tables.get('personal_mnemonics') ?? [])];
    if (/WHERE item_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.item_id === params[0]);
    }
    return rows;
  }

  if (/FROM related_item_boosts/i.test(trimmed)) {
    let rows = [...(state.tables.get('related_item_boosts') ?? [])];
    if (/WHERE item_id IN/i.test(trimmed)) {
      const ids = new Set(params);
      rows = rows.filter((row) => ids.has(row.item_id));
    }
    return rows;
  }

  if (/FROM reading_passages/i.test(trimmed)) {
    let rows = [...(state.tables.get('reading_passages') ?? [])];

    if (/WHERE id = \?/i.test(trimmed)) {
      return rows.filter((row) => row.id === params[0]);
    }

    if (/WHERE rp\.jlpt_level = \?/i.test(trimmed) || /WHERE jlpt_level = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.jlpt_level === params[0]);
    }

    if (/ORDER BY rp\.sort_order ASC/i.test(trimmed) || /ORDER BY sort_order ASC/i.test(trimmed)) {
      rows.sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
    }

    if (/SELECT COUNT\(\*\) FROM passage_questions/i.test(trimmed)) {
      const questions = state.tables.get('passage_questions') ?? [];
      return rows.map((row) => ({
        ...row,
        question_count: questions.filter((question) => question.passage_id === row.id).length,
      }));
    }

    return rows;
  }

  if (/FROM passage_questions/i.test(trimmed)) {
    let rows = [...(state.tables.get('passage_questions') ?? [])];
    if (/WHERE passage_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.passage_id === params[0]);
    }
    if (/ORDER BY sort_order ASC/i.test(trimmed)) {
      rows.sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
    }
    return rows;
  }

  if (/FROM items/i.test(trimmed)) {
    let rows = [...(state.tables.get('items') ?? [])];

    if (/WHERE id = \?/i.test(trimmed)) {
      return rows.filter((row) => row.id === params[0]);
    }

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

export function __mockSetItemStudyStatuses(
  databaseName: string,
  rows: Array<{ item_id: number; status: string; updated_at: string }>,
) {
  const state = getDatabaseState(databaseName);
  state.tables.set('item_study_status', rows.map((row) => ({ ...row })));
}

export function __mockSetSrsStates(
  databaseName: string,
  rows: Array<{
    item_id: number;
    stability: number;
    difficulty: number;
    due_date: string;
    fsrs_state: string;
    reps: number;
    lapses: number;
    is_burned: number;
    srs_stage_label: string;
    updated_at: string;
  }>,
) {
  const state = getDatabaseState(databaseName);
  state.tables.set('srs_states', rows.map((row) => ({ ...row })));
}

export function __mockSetPersonalMnemonics(
  databaseName: string,
  rows: Array<{ item_id: number; mnemonic_text: string; updated_at: string }>,
) {
  const state = getDatabaseState(databaseName);
  state.tables.set('personal_mnemonics', rows.map((row) => ({ ...row })));
}

export function __mockSetKanjiReadings(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('kanji_readings', rows.map((row) => ({ ...row })));
}

export function __mockSetAcceptedAnswers(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('accepted_answers', rows.map((row) => ({ ...row })));
}

export function __mockSetGrammarRules(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('grammar_rules', rows.map((row) => ({ ...row })));
}

export function __mockSetExampleSentences(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('example_sentences', rows.map((row) => ({ ...row })));
}

export function __mockSetGrammarVocabLinks(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('grammar_vocabulary_links', rows.map((row) => ({ ...row })));
}

export function __mockSetReadingPassages(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('reading_passages', rows.map((row) => ({ ...row })));
}

export function __mockSetPassageQuestions(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('passage_questions', rows.map((row) => ({ ...row })));
}

export function __mockSetPassagePracticeResults(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('passage_practice_results', rows.map((row) => ({ ...row })));
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
