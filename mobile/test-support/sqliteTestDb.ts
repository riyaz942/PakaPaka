import { TextDecoder as NodeTextDecoder } from 'node:util';

import type { SQLiteDatabase } from 'expo-sqlite';
import initSqlJs, { type BindParams, type Database, type SqlJsStatic, type SqlValue } from 'sql.js';

import type { ItemRef } from '@/core/backup/backup.types';
import { migrations } from '@/data/migrations';
import { runMigrations } from '@/data/migrations/migrationRunner';

/**
 * A real SQLite engine (sql.js, in memory) behind the `expo-sqlite` methods the sync data layer
 * and the migration runner use. Every other `SQLiteDatabase` method is absent. The shared
 * expo-sqlite mock is a regex emulator with no async API, so sync data tests use this instead.
 */
export type TestDb = SQLiteDatabase;

let sqlJs: Promise<SqlJsStatic> | null = null;

/**
 * sql.js makes its one `TextDecoder` while it loads. Under jest-expo the global is expo's polyfill,
 * which decodes a WebAssembly memory view as '' (its `instanceof ArrayBuffer` check fails across
 * realms), so every file name and text value would be empty. sql.js gets Node's decoder instead;
 * the global is put back at once.
 */
function loadSqlJs(): Promise<SqlJsStatic> {
  const globalDecoder = globalThis.TextDecoder;
  globalThis.TextDecoder = NodeTextDecoder as typeof TextDecoder;
  try {
    return initSqlJs();
  } finally {
    globalThis.TextDecoder = globalDecoder;
  }
}

/** expo-sqlite takes `(sql, a, b)`, `(sql, [a, b])` or `(sql, { $a: a })`. */
function toBindParams(params: unknown[]): BindParams {
  const [first] = params;
  if (params.length === 1 && first !== null && typeof first === 'object' && !(first instanceof Uint8Array)) {
    return first as BindParams;
  }
  return params as SqlValue[];
}

function allRows<T>(db: Database, source: string, params: unknown[]): T[] {
  const statement = db.prepare(source);
  try {
    statement.bind(toBindParams(params));
    const rows: T[] = [];
    while (statement.step()) rows.push(statement.getAsObject() as T);
    return rows;
  } finally {
    statement.free();
  }
}

function run(db: Database, source: string, params: unknown[]) {
  db.run(source, toBindParams(params));
  const changes = db.getRowsModified();
  const lastInsertRowId = Number(db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
  return { changes, lastInsertRowId };
}

function transactionSync(db: Database, begin: string, task: () => void): void {
  db.exec(begin);
  try {
    task();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

async function transactionAsync(db: Database, begin: string, task: () => Promise<void>): Promise<void> {
  db.exec(begin);
  try {
    await task();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * An in-memory `user.db` with every real migration applied and an attached `curriculum` database
 * holding the minimal tables the sync lookup reads.
 */
export async function openTestUserDb(): Promise<TestDb> {
  sqlJs ??= loadSqlJs();
  const db = new (await sqlJs).Database();
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    ATTACH DATABASE ':memory:' AS curriculum;
    CREATE TABLE curriculum.items (id INTEGER PRIMARY KEY, item_type TEXT NOT NULL, slug TEXT NOT NULL);
    CREATE TABLE curriculum.reading_passages (id INTEGER PRIMARY KEY);
    CREATE TABLE curriculum.passage_questions (id INTEGER PRIMARY KEY, passage_id INTEGER NOT NULL);
    CREATE TABLE curriculum.curriculum_metadata (version TEXT PRIMARY KEY NOT NULL);
  `);

  const testDb = {
    execSync: (source: string) => {
      db.exec(source);
    },
    runSync: (source: string, ...params: unknown[]) => run(db, source, params),
    getAllSync: (source: string, ...params: unknown[]) => allRows(db, source, params),
    getFirstSync: (source: string, ...params: unknown[]) => allRows(db, source, params)[0] ?? null,
    withTransactionSync: (task: () => void) => transactionSync(db, 'BEGIN', task),
    runAsync: async (source: string, ...params: unknown[]) => run(db, source, params),
    getAllAsync: async (source: string, ...params: unknown[]) => allRows(db, source, params),
    getFirstAsync: async (source: string, ...params: unknown[]) =>
      allRows(db, source, params)[0] ?? null,
    withTransactionAsync: (task: () => Promise<void>) => transactionAsync(db, 'BEGIN', task),
    withExclusiveTransactionAsync: (task: (txn: unknown) => Promise<void>) =>
      transactionAsync(db, 'BEGIN EXCLUSIVE', () => task(testDb)),
  };

  const migrated = runMigrations(testDb as unknown as TestDb, migrations);
  if (!migrated.ok) throw new Error(migrated.error.message);
  return testDb as unknown as TestDb;
}

/** Adds curriculum rows: items by row id, passage questions as `[passageId, questionId]`. */
export async function seedCurriculum(
  db: TestDb,
  content: {
    items?: [number, ItemRef][];
    questions?: [number, number][];
    version?: string;
  },
): Promise<void> {
  for (const [id, item] of content.items ?? []) {
    await db.runAsync(
      'INSERT INTO curriculum.items (id, item_type, slug) VALUES (?, ?, ?)',
      id,
      item.itemType,
      item.slug,
    );
  }
  for (const [passageId, questionId] of content.questions ?? []) {
    await db.runAsync('INSERT OR IGNORE INTO curriculum.reading_passages (id) VALUES (?)', passageId);
    await db.runAsync(
      'INSERT INTO curriculum.passage_questions (id, passage_id) VALUES (?, ?)',
      questionId,
      passageId,
    );
  }
  if (content.version !== undefined) {
    await db.runAsync('INSERT INTO curriculum.curriculum_metadata (version) VALUES (?)', content.version);
  }
}
