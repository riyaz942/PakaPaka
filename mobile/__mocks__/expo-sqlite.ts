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

/**
 * Zip an INSERT's declared columns against its VALUES tokens, consuming one
 * bound param per `?` and keeping literal NULL/number tokens as written. Callers
 * that mix bound and literal values (the AI session insert, srs_states) would
 * otherwise mis-align once a second caller binds a different column set.
 */
function zipInsertRow(sql: string, params: unknown[]): Row {
  const match = sql.match(/INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+[a-zA-Z0-9_]+\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if (!match) {
    throw new Error(`Unrecognized insert: ${sql}`);
  }
  const columns = match[1].split(',').map((column) => column.trim());
  const valueTokens = match[2].split(',').map((token) => token.trim());

  const row: Row = {};
  let paramIndex = 0;
  columns.forEach((column, index) => {
    const token = valueTokens[index];
    if (token === '?') {
      row[column] = params[paramIndex];
      paramIndex += 1;
    } else if (/^NULL$/i.test(token)) {
      row[column] = null;
    } else if (/^-?\d+(\.\d+)?$/.test(token)) {
      row[column] = Number(token);
    } else {
      row[column] = token;
    }
  });
  return row;
}

function upsertSrsState(
  state: MockDatabaseState,
  sql: string,
  params: unknown[],
) {
  // Column-aware: the srs_states INSERTs differ in shape (importRepository uses
  // a literal NULL for last_reviewed_at), so zip the declared column list
  // against the VALUES clause, consuming a param per `?` placeholder.
  const match = sql.match(
    /INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+srs_states\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
  );
  if (!match) {
    throw new Error(`Unrecognized srs_states insert: ${sql}`);
  }
  const columns = match[1].split(',').map((column) => column.trim());
  const valueTokens = match[2].split(',').map((token) => token.trim());

  const nextRow: Row = {};
  let paramIndex = 0;
  columns.forEach((column, index) => {
    const token = valueTokens[index];
    if (token === '?') {
      nextRow[column] = params[paramIndex];
      paramIndex += 1;
    } else if (/^NULL$/i.test(token)) {
      nextRow[column] = null;
    } else {
      nextRow[column] = token;
    }
  });

  const itemId = nextRow.item_id;
  const rows = state.tables.get('srs_states') ?? [];
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

  // Replace-all restore empties a table wholesale. Checked before the
  // WHERE-filtered DELETE handlers below, which would otherwise filter on an
  // undefined param and leave every row in place.
  const truncate = trimmed.match(/^DELETE FROM\s+([a-zA-Z0-9_]+)\s*;?$/i);
  if (truncate) {
    state.tables.set(truncate[1], []);
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
    upsertSrsState(state, trimmed, params);
    return;
  }

  if (/^INSERT OR IGNORE INTO srs_states/i.test(trimmed)) {
    const rows = state.tables.get('srs_states') ?? [];
    const exists = rows.some((row) => row.item_id === params[0]);
    if (!exists) {
      upsertSrsState(state, trimmed, params);
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

  if (/^DELETE FROM furigana_overrides/i.test(trimmed)) {
    const rows = state.tables.get('furigana_overrides') ?? [];
    // No WHERE clause = the Settings "reset all overrides" action.
    state.tables.set(
      'furigana_overrides',
      /WHERE item_id = \?/i.test(trimmed) ? rows.filter((row) => row.item_id !== params[0]) : [],
    );
    return;
  }

  if (/^INSERT INTO furigana_overrides/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    const [itemId, displayMode, updatedAt] = params;
    const rows = state.tables.get('furigana_overrides') ?? [];
    const idx = rows.findIndex((row) => row.item_id === itemId);
    const next = { item_id: itemId, display_mode: displayMode, updated_at: updatedAt };
    if (idx >= 0) rows[idx] = next;
    else rows.push(next);
    state.tables.set('furigana_overrides', rows);
    return;
  }

  if (/^INSERT INTO card_seen/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    const [cardId, seenAt] = params;
    const rows = state.tables.get('card_seen') ?? [];
    // DO NOTHING on conflict: the first sighting keeps its `seen_at`.
    if (!rows.some((row) => row.card_id === cardId)) {
      rows.push({ card_id: cardId, seen_at: seenAt });
    }
    state.tables.set('card_seen', rows);
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

  if (/^INSERT INTO cognitive_load_history/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    const [date, load, threshold, updatedAt] = params;
    const rows = state.tables.get('cognitive_load_history') ?? [];
    const idx = rows.findIndex((row) => row.date === date);
    const next = { date, load, threshold, updated_at: updatedAt };
    if (idx >= 0) rows[idx] = next;
    else rows.push(next);
    state.tables.set('cognitive_load_history', rows);
    return;
  }

  if (/^INSERT INTO goal_ring_state/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    const [dailyGoalTarget, goalWeekStart, consecutiveMissWeeks, pendingRiseTo, pendingReductionTo, updatedAt] = params;
    state.tables.set('goal_ring_state', [
      {
        id: 1,
        daily_goal_target: dailyGoalTarget,
        goal_week_start: goalWeekStart,
        consecutive_miss_weeks: consecutiveMissWeeks,
        pending_rise_to: pendingRiseTo,
        pending_reduction_to: pendingReductionTo,
        updated_at: updatedAt,
      },
    ]);
    return;
  }

  if (/^INSERT INTO daily_lesson_log/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    const [date, itemsStarted] = params;
    const rows = state.tables.get('daily_lesson_log') ?? [];
    const idx = rows.findIndex((row) => row.date === date);
    if (idx >= 0) {
      rows[idx] = {
        ...rows[idx],
        items_started: Number(rows[idx].items_started ?? 0) + Number(itemsStarted),
      };
    } else {
      rows.push({ date, items_started: Number(itemsStarted) });
    }
    state.tables.set('daily_lesson_log', rows);
    return;
  }

  if (/^INSERT INTO streaks/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    const [currentStreak, longestStreak, lastReviewDate, updatedAt] = params;
    // ON CONFLICT DO UPDATE only touches the listed columns — preserve the rest
    // of an existing row (last_celebrated_date).
    const existing = (state.tables.get('streaks') ?? [])[0];
    state.tables.set('streaks', [
      {
        ...existing,
        id: 1,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_review_date: lastReviewDate,
        updated_at: updatedAt,
      },
    ]);
    return;
  }

  if (/^UPDATE streaks SET last_celebrated_date/i.test(trimmed)) {
    const rows = state.tables.get('streaks') ?? [];
    if (rows.length > 0) {
      rows[0] = { ...rows[0], last_celebrated_date: params[0], updated_at: params[1] };
      state.tables.set('streaks', rows);
    }
    return;
  }

  // Vacation resume shifts one card at a time (see srsStateRepository).
  if (/^UPDATE srs_states\s+SET due_date = \?, last_reviewed_at = \?, updated_at = \?/i.test(trimmed)) {
    const rows = state.tables.get('srs_states') ?? [];
    const [dueDate, lastReviewedAt, updatedAt, itemId] = params;
    const index = rows.findIndex((row) => row.item_id === itemId);
    if (index >= 0) {
      rows[index] = {
        ...rows[index],
        due_date: dueDate,
        last_reviewed_at: lastReviewedAt,
        updated_at: updatedAt,
      };
      state.tables.set('srs_states', rows);
    }
    return;
  }

  if (/^INSERT INTO weakness_stats/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
    const rows = state.tables.get('weakness_stats') ?? [];
    const numericId = Number(params[0]);
    const updatedAt = params[params.length - 1];
    const idx = rows.findIndex((row) => row.item_id === numericId);

    if (/correct_count = correct_count \+ 1/i.test(trimmed)) {
      // correct outcome
      if (idx >= 0) {
        rows[idx] = {
          ...rows[idx],
          correct_count: Number(rows[idx].correct_count ?? 0) + 1,
          updated_at: updatedAt,
        };
      } else {
        rows.push({ item_id: numericId, correct_count: 1, incorrect_count: 0, typo_count: 0, last_error_at: null, last_error_type: null, pattern_tags: null, updated_at: updatedAt });
      }
    } else if (/incorrect_count = incorrect_count \+ 1/i.test(trimmed)) {
      // incorrect outcome: params = (numericId, lastErrorAt, promptType, updatedAt)
      const lastErrorAt = params[1];
      const lastErrorType = params[2];
      if (idx >= 0) {
        rows[idx] = {
          ...rows[idx],
          incorrect_count: Number(rows[idx].incorrect_count ?? 0) + 1,
          last_error_at: lastErrorAt,
          last_error_type: lastErrorType,
          updated_at: updatedAt,
        };
      } else {
        rows.push({ item_id: numericId, correct_count: 0, incorrect_count: 1, typo_count: 0, last_error_at: lastErrorAt, last_error_type: lastErrorType, pattern_tags: null, updated_at: updatedAt });
      }
    } else if (/typo_count = typo_count \+ 1/i.test(trimmed)) {
      // typo outcome
      if (idx >= 0) {
        rows[idx] = {
          ...rows[idx],
          typo_count: Number(rows[idx].typo_count ?? 0) + 1,
          updated_at: updatedAt,
        };
      } else {
        rows.push({ item_id: numericId, correct_count: 0, incorrect_count: 0, typo_count: 1, last_error_at: null, last_error_type: null, pattern_tags: null, updated_at: updatedAt });
      }
    }
    state.tables.set('weakness_stats', rows);
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

  // --- AI conversation tables (017_ai_sessions) ---

  if (/^INSERT INTO ai_sessions/i.test(trimmed)) {
    // Column-aware, like the srs_states insert above: the session repository
    // writes literal NULL/0 for the columns it does not bind, while a restore
    // binds all twelve. Zip the column list against the VALUES tokens and
    // consume one param per `?`.
    const rows = state.tables.get('ai_sessions') ?? [];
    rows.push(zipInsertRow(trimmed, params));
    state.tables.set('ai_sessions', rows);
    return;
  }

  if (/^INSERT INTO ai_messages/i.test(trimmed)) {
    const rows = state.tables.get('ai_messages') ?? [];
    rows.push({
      id: params[0],
      session_id: params[1],
      role: params[2],
      content: params[3],
      created_at: params[4],
    });
    state.tables.set('ai_messages', rows);
    return;
  }

  if (/^UPDATE ai_sessions/i.test(trimmed)) {
    const rows = state.tables.get('ai_sessions') ?? [];
    // The id is always the last bound parameter across every ai_sessions update.
    const sessionId = params[params.length - 1];
    const index = rows.findIndex((row) => row.id === sessionId);
    if (index >= 0) {
      if (/turn_count = turn_count \+ 1/i.test(trimmed)) {
        rows[index] = {
          ...rows[index],
          turn_count: Number(rows[index].turn_count ?? 0) + 1,
        };
      } else if (/ended_at = \?/i.test(trimmed)) {
        rows[index] = { ...rows[index], ended_at: params[0], ended_reason: params[1] };
      } else if (/summary_json = NULL/i.test(trimmed) && /summary_generated_at = NULL/i.test(trimmed)) {
        rows[index] = {
          ...rows[index],
          summary_json: null,
          summary_generated_at: null,
        };
      } else if (/summary_json = \?/i.test(trimmed)) {
        if (/summary_generated_at IS NULL/i.test(trimmed) && rows[index].summary_generated_at != null) {
          // Once-only cache: leave the existing summary untouched.
        } else {
          rows[index] = {
            ...rows[index],
            summary_json: params[0],
            summary_generated_at: params[1],
          };
        }
      } else if (/started_at = \?/i.test(trimmed)) {
        rows[index] = { ...rows[index], started_at: params[0] };
      }
      state.tables.set('ai_sessions', rows);
    }
    return;
  }

  if (/^DELETE FROM ai_sessions/i.test(trimmed)) {
    const sessionId = params[0];
    const rows = state.tables.get('ai_sessions') ?? [];
    state.tables.set(
      'ai_sessions',
      rows.filter((row) => row.id !== sessionId),
    );
    // Mirror ON DELETE CASCADE (PRAGMA foreign_keys = ON in production).
    const messages = state.tables.get('ai_messages') ?? [];
    state.tables.set(
      'ai_messages',
      messages.filter((row) => row.session_id !== sessionId),
    );
    return;
  }

  // Plain parameterized INSERT, appended last so every table-specific handler
  // above still wins. Restore (9.2) writes every user table this way.
  const genericInsert = trimmed.match(
    /^INSERT INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
  );
  if (genericInsert && trimmed.includes('?')) {
    const table = genericInsert[1];
    const rows = state.tables.get(table) ?? [];
    rows.push(zipInsertRow(trimmed, params));
    state.tables.set(table, rows);
  }
}

function queryRows(state: MockDatabaseState, sql: string, params: unknown[] = []): Row[] {
  const trimmed = sql.trim();

  // There is no real ATTACH here, so the `curriculum.*` reads a restore issues
  // resolve against tables seeded into the same mock database.
  if (/FROM curriculum\.items/i.test(trimmed)) {
    return [...(state.tables.get('items') ?? [])];
  }

  if (/FROM curriculum\.reading_passages/i.test(trimmed)) {
    return [...(state.tables.get('reading_passages') ?? [])];
  }

  if (/FROM curriculum\.passage_questions/i.test(trimmed)) {
    return [...(state.tables.get('passage_questions') ?? [])];
  }

  if (/FROM user_synonyms/i.test(trimmed)) {
    return [...(state.tables.get('user_synonyms') ?? [])];
  }

  if (/FROM ai_sessions/i.test(trimmed)) {
    let rows = [...(state.tables.get('ai_sessions') ?? [])];
    if (/WHERE id = \?/i.test(trimmed)) {
      return rows.filter((row) => row.id === params[0]);
    }
    if (/ORDER BY started_at DESC/i.test(trimmed)) {
      rows.sort((left, right) => String(right.started_at).localeCompare(String(left.started_at)));
    }
    return rows;
  }

  if (/FROM ai_messages/i.test(trimmed)) {
    let rows = [...(state.tables.get('ai_messages') ?? [])];
    if (/WHERE session_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.session_id === params[0]);
    }
    if (/ORDER BY created_at ASC/i.test(trimmed)) {
      // Stable within a millisecond: two turns written in the same tick keep
      // insertion order, which is the order they were actually spoken.
      rows = rows
        .map((row, index) => ({ row, index }))
        .sort((left, right) => {
          const byTime = String(left.row.created_at).localeCompare(String(right.row.created_at));
          return byTime !== 0 ? byTime : left.index - right.index;
        })
        .map((entry) => entry.row);
    }
    return rows;
  }

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
    if (/WHERE item_id IN/i.test(trimmed)) {
      const allowedIds = new Set(params);
      rows = rows.filter((row) => allowedIds.has(row.item_id));
      if (/COUNT\(\*\)/i.test(trimmed)) {
        return [{ count: rows.length }];
      }
      return rows;
    }
    if (/COUNT\(\*\)/i.test(trimmed)) {
      // Apply the predicate *before* counting. Counting the whole table and
      // ignoring the WHERE silently reports inflated totals (the mock pitfall
      // recorded in deferred-work.md).
      if (/WHERE due_date <= \? AND is_burned = 0/i.test(trimmed)) {
        const nowIso = String(params[0]);
        rows = rows.filter(
          (row) => String(row.due_date) <= nowIso && row.is_burned === 0,
        );
      }

      if (/GROUP BY srs_stage_label/i.test(trimmed)) {
        const counts = new Map<string, number>();
        for (const row of rows) {
          const label = String(row.srs_stage_label);
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        return Array.from(counts.entries()).map(([srs_stage_label, count]) => ({
          srs_stage_label,
          count,
        }));
      }
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
    // Vacation resume: the not-yet-due, unburned rows to push forward.
    if (/WHERE due_date > \? AND is_burned = 0/i.test(trimmed)) {
      const afterIso = String(params[0]);
      return rows.filter(
        (row) => String(row.due_date) > afterIso && row.is_burned === 0,
      );
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

  if (/FROM grammar_related_links/i.test(trimmed) && /JOIN items/i.test(trimmed)) {
    const links = [...(state.tables.get('grammar_related_links') ?? [])];
    const items = state.tables.get('items') ?? [];

    return links
      .filter((link) => link.grammar_item_id === params[0])
      .sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0))
      .map((link) => {
        const related = items.find((item) => item.id === link.related_item_id);
        return {
          id: related?.id,
          primary_form: related?.primary_form ?? '',
          meaning: related?.meaning ?? '',
        };
      });
  }

  if (/FROM visually_similar_links/i.test(trimmed) && /JOIN items/i.test(trimmed)) {
    const links = [...(state.tables.get('visually_similar_links') ?? [])];
    const items = state.tables.get('items') ?? [];

    return links
      .filter((link) => link.item_id === params[0])
      .sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0))
      .map((link) => {
        const similar = items.find((item) => item.id === link.similar_item_id);
        return {
          id: similar?.id,
          primary_form: similar?.primary_form ?? '',
          meaning: similar?.meaning ?? '',
          item_type: similar?.item_type ?? '',
        };
      });
  }

  if (/FROM example_sentence_spans/i.test(trimmed)) {
    const spans = [...(state.tables.get('example_sentence_spans') ?? [])];

    // Every taught-inflected surface in the curriculum (15.1's chat word index),
    // which is the same join with no item filter.
    if (/JOIN example_sentences/i.test(trimmed) && params.length === 0) {
      const sentences = state.tables.get('example_sentences') ?? [];
      return spans
        .filter((span) => span.inflection != null)
        .map((span) => ({
          item_id: span.item_id,
          inflection: span.inflection,
          start_offset: span.start_offset,
          end_offset: span.end_offset,
          text:
            sentences.find((sentence) => Number(sentence.id) === Number(span.sentence_id))
              ?.japanese ?? '',
        }));
    }

    // Taught conjugated forms for one item (14.1), sliced from its sentence.
    if (/JOIN example_sentences/i.test(trimmed)) {
      const sentences = state.tables.get('example_sentences') ?? [];
      return spans
        .filter(
          (span) => Number(span.item_id) === Number(params[0]) && span.inflection != null,
        )
        .sort(
          (left, right) =>
            Number(left.sentence_id) - Number(right.sentence_id) ||
            Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0),
        )
        .map((span) => ({
          inflection: span.inflection,
          start_offset: span.start_offset,
          end_offset: span.end_offset,
          japanese:
            sentences.find((sentence) => Number(sentence.id) === Number(span.sentence_id))
              ?.japanese ?? '',
        }));
    }

    const spanSentenceIds = new Set(params.map((value) => Number(value)));
    return spans
      .filter((span) => spanSentenceIds.has(Number(span.sentence_id)))
      .sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0));
  }

  if (/FROM example_sentence_vocab/i.test(trimmed) && /JOIN items/i.test(trimmed)) {
    const links = [...(state.tables.get('example_sentence_vocab') ?? [])];
    const items = state.tables.get('items') ?? [];
    const sentenceIds = new Set(params.map((value) => Number(value)));

    return links
      .filter((link) => sentenceIds.has(Number(link.sentence_id)))
      .sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0))
      .map((link) => {
        const item = items.find((candidate) => candidate.id === link.item_id);
        return {
          sentence_id: link.sentence_id,
          item_id: link.item_id,
          primary_form: item?.primary_form ?? '',
        };
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

  if (/FROM accepted_answers aa/i.test(trimmed) && /JOIN items/i.test(trimmed)) {
    // Answer-collision lookup (Story 1.2, FR86):
    // params = (answer_type, exclude_item_id, ...lowercased candidates)
    const answers = state.tables.get('accepted_answers') ?? [];
    const items = state.tables.get('items') ?? [];
    const answerType = params[0];
    const excludeId = Number(params[1]);
    const candidates = new Set(params.slice(2).map((value) => String(value).toLowerCase()));
    return answers
      .filter(
        (row) =>
          row.answer_type === answerType &&
          Number(row.item_id) !== excludeId &&
          candidates.has(String(row.answer_text).toLowerCase()),
      )
      .map((row) => {
        const item = items.find((candidate) => candidate.id === row.item_id);
        return {
          item_id: row.item_id,
          answer_text: row.answer_text,
          primary_form: item?.primary_form ?? '',
          item_type: item?.item_type,
        };
      });
  }

  if (/FROM kanji_readings kr/i.test(trimmed) && /JOIN items/i.test(trimmed)) {
    // Answer-collision lookup against kanji readings (Story 1.2, FR86):
    // params = (exclude_item_id, ...lowercased candidates)
    const readings = state.tables.get('kanji_readings') ?? [];
    const items = state.tables.get('items') ?? [];
    const excludeId = Number(params[0]);
    const candidates = new Set(params.slice(1).map((value) => String(value).toLowerCase()));
    return readings
      .filter(
        (row) =>
          Number(row.item_id) !== excludeId &&
          candidates.has(String(row.reading).toLowerCase()),
      )
      .map((row) => {
        const item = items.find((candidate) => candidate.id === row.item_id);
        return {
          item_id: row.item_id,
          answer_text: row.reading,
          primary_form: item?.primary_form ?? '',
          item_type: item?.item_type,
        };
      });
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

    const literalType = trimmed.match(/relationship_type\s*=\s*'(\w+)'/i)?.[1];
    const usesBoundType = /relationship_type\s*=\s*\?/i.test(trimmed);
    const relationshipType = literalType ?? (usesBoundType ? String(params[params.length - 1]) : 'requires');
    const idParams = usesBoundType ? params.slice(0, -1) : params;

    const childIds = /child_item_id IN/i.test(trimmed)
      ? new Set(idParams)
      : new Set([idParams[0]]);

    return relationships
      .filter(
        (relationship) =>
          childIds.has(relationship.child_item_id) &&
          relationship.relationship_type === relationshipType,
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

  if (/FROM furigana_overrides/i.test(trimmed)) {
    let rows = [...(state.tables.get('furigana_overrides') ?? [])];
    if (/WHERE item_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.item_id === params[0]);
    }
    return rows;
  }

  if (/FROM card_seen/i.test(trimmed)) {
    let rows = [...(state.tables.get('card_seen') ?? [])];
    if (/WHERE card_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.card_id === params[0]);
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

  if (/FROM cognitive_load_history/i.test(trimmed)) {
    let rows = [...(state.tables.get('cognitive_load_history') ?? [])];
    if (/WHERE date = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.date === params[0]);
    }
    if (/WHERE date < \?/i.test(trimmed)) {
      rows = rows.filter((row) => String(row.date) < String(params[0]));
    }
    if (/WHERE date >= \? AND date < \?/i.test(trimmed)) {
      rows = rows.filter(
        (row) => String(row.date) >= String(params[0]) && String(row.date) < String(params[1]),
      );
    }
    if (/AND load > 0/i.test(trimmed)) {
      rows = rows.filter((row) => Number(row.load) > 0);
    }
    if (/ORDER BY date ASC/i.test(trimmed)) {
      rows.sort((left, right) => String(left.date).localeCompare(String(right.date)));
    }
    if (/ORDER BY date DESC/i.test(trimmed)) {
      rows.sort((left, right) => String(right.date).localeCompare(String(left.date)));
    }
    if (/LIMIT \?/i.test(trimmed)) {
      const limit = Number(params[params.length - 1]);
      rows = rows.slice(0, limit);
    }
    if (/SELECT load FROM/i.test(trimmed)) {
      return rows.map((row) => ({ load: row.load }));
    }
    return rows;
  }

  if (/FROM daily_lesson_log/i.test(trimmed)) {
    let rows = [...(state.tables.get('daily_lesson_log') ?? [])];
    if (/WHERE date = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.date === params[0]);
    }
    return rows;
  }

  if (/FROM goal_ring_state/i.test(trimmed)) {
    const rows = [...(state.tables.get('goal_ring_state') ?? [])];
    if (/WHERE id = 1/i.test(trimmed)) {
      return rows.filter((row) => Number(row.id) === 1);
    }
    return rows;
  }

  if (/FROM streaks/i.test(trimmed)) {
    const rows = [...(state.tables.get('streaks') ?? [])];
    if (/WHERE id = 1/i.test(trimmed)) {
      return rows.filter((row) => Number(row.id) === 1);
    }
    return rows;
  }

  if (/FROM weakness_stats/i.test(trimmed)) {
    let rows = [...(state.tables.get('weakness_stats') ?? [])];
    if (/WHERE item_id IN/i.test(trimmed)) {
      const ids = new Set(params.map(Number));
      rows = rows.filter((row) => ids.has(Number(row.item_id)));
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

  if (/FROM passage_vocabulary_links/i.test(trimmed)) {
    let rows = [...(state.tables.get('passage_vocabulary_links') ?? [])];
    if (/WHERE passage_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.passage_id === params[0]);
    }
    return rows;
  }

  if (/FROM passage_grammar_links/i.test(trimmed)) {
    let rows = [...(state.tables.get('passage_grammar_links') ?? [])];
    if (/WHERE passage_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.passage_id === params[0]);
    }
    return rows;
  }

  if (/FROM passage_word_spans/i.test(trimmed)) {
    let rows = [...(state.tables.get('passage_word_spans') ?? [])];

    // Every taught-inflected surface in the shipped passages (15.1's chat word
    // index), sliced from the body it occurs in.
    if (/JOIN reading_passages/i.test(trimmed)) {
      const passages = state.tables.get('reading_passages') ?? [];
      return rows
        .filter((row) => row.inflection != null)
        .map((row) => ({
          item_id: row.vocabulary_item_id,
          inflection: row.inflection,
          start_offset: row.start_offset,
          end_offset: row.end_offset,
          text: passages.find((passage) => Number(passage.id) === Number(row.passage_id))?.body ?? '',
        }));
    }

    if (/WHERE passage_id = \?/i.test(trimmed)) {
      rows = rows.filter((row) => row.passage_id === params[0]);
    }
    if (/ORDER BY sort_order ASC/i.test(trimmed)) {
      rows.sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
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

    // Before the generic filters below: an unhandled slug lookup would fall
    // through them and return the whole table, so `getFirstSync` would hand
    // back an arbitrary item and the caller's test would look green.
    if (/WHERE item_type = \? AND slug = \?/i.test(trimmed)) {
      return rows.filter((row) => row.item_type === params[0] && row.slug === params[1]);
    }

    if (/WHERE id IN/i.test(trimmed)) {
      // Honour the IN list: ignoring it would silently return the whole table
      // and make id-filtered reads look correct when they are not.
      rows = rows.filter((row) => params.includes(row.id as never));
      if (/ORDER BY sort_order ASC/i.test(trimmed)) {
        rows.sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
      }
      return rows;
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

  get databasePath(): string {
    return `/mock-sqlite/${this.databaseName}`;
  }

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
    // Every table, not a fixed list: a restore rewrites all of them, and a
    // partial snapshot would let a rollback test pass while `user_preferences`
    // or `goal_ring_state` kept the half-written values.
    const snapshot = snapshotTables(state, Array.from(state.tables.keys()));
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

export function __mockSetExampleSentenceVocab(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('example_sentence_vocab', rows.map((row) => ({ ...row })));
}

export function __mockSetExampleSentenceSpans(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('example_sentence_spans', rows.map((row) => ({ ...row })));
}

export function __mockSetGrammarVocabLinks(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('grammar_vocabulary_links', rows.map((row) => ({ ...row })));
}

export function __mockSetGrammarRelatedLinks(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('grammar_related_links', rows.map((row) => ({ ...row })));
}

export function __mockSetVisuallySimilarLinks(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('visually_similar_links', rows.map((row) => ({ ...row })));
}

export function __mockSetReadingPassages(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('reading_passages', rows.map((row) => ({ ...row })));
}

export function __mockSetPassageVocabularyLinks(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('passage_vocabulary_links', rows.map((row) => ({ ...row })));
}

export function __mockSetPassageGrammarLinks(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('passage_grammar_links', rows.map((row) => ({ ...row })));
}

export function __mockSetPassageWordSpans(databaseName: string, rows: Row[]) {
  const state = getDatabaseState(databaseName);
  state.tables.set('passage_word_spans', rows.map((row) => ({ ...row })));
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
