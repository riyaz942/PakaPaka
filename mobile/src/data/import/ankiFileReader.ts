import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import {
  listCollectionDbFileNames,
  parseAnkiCollection,
  type AnkiRawCollectionData,
} from '@/core/import/ankiParser';
import type { AnkiParseResult } from '@/core/import/import.types';
import type { AppError, Result } from '@/types/result.types';

const ANKI_INVALID_FILE_MESSAGE =
  "This file doesn't appear to be a valid Anki deck. Make sure you're selecting an .apkg file exported from Anki.";

const ANKI_DB_READ_ERROR_MESSAGE =
  'Could not read the deck database. The file may be corrupted.';

export type AnkiFileReaderDeps = {
  readFileBase64?: (uri: string) => Promise<string>;
  unzipArchive?: (base64: string, tempDir: string) => Promise<Result<string[], AppError>>;
  queryCollectionDatabase?: (dbPath: string) => Promise<Result<AnkiRawCollectionData, AppError>>;
  makeTempDir?: () => string;
  deletePath?: (uri: string, options?: { idempotent?: boolean }) => Promise<void>;
};

function ankiInvalidFileError(message: string, cause?: unknown): Result<never, AppError> {
  return {
    ok: false,
    error: {
      code: 'anki_invalid_file',
      message,
      userMessage: ANKI_INVALID_FILE_MESSAGE,
      cause,
    },
  };
}

function ankiDbReadError(message: string, cause?: unknown): Result<never, AppError> {
  return {
    ok: false,
    error: {
      code: 'anki_db_read_failed',
      message,
      userMessage: ANKI_DB_READ_ERROR_MESSAGE,
      cause,
    },
  };
}

async function defaultReadFileBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

function defaultMakeTempDir(): string {
  return `${FileSystem.documentDirectory}anki-import-${Date.now()}/`;
}

async function defaultDeletePath(uri: string, options?: { idempotent?: boolean }): Promise<void> {
  await FileSystem.deleteAsync(uri, options);
}

async function defaultUnzipArchive(
  base64: string,
  tempDir: string,
): Promise<Result<string[], AppError>> {
  try {
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const fileNames = Object.keys(zip.files).filter((name) => !zip.files[name]?.dir);

    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

    for (const fileName of fileNames) {
      const entry = zip.files[fileName];
      if (!entry || entry.dir) {
        continue;
      }

      const content = await entry.async('base64');
      const targetPath = `${tempDir}${fileName}`;
      const slashIndex = fileName.lastIndexOf('/');
      if (slashIndex >= 0) {
        const parentDir = `${tempDir}${fileName.slice(0, slashIndex + 1)}`;
        await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
      }
      await FileSystem.writeAsStringAsync(targetPath, content, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    return { ok: true, value: fileNames };
  } catch (cause) {
    return ankiInvalidFileError('Failed to extract Anki archive', cause);
  }
}

async function defaultQueryCollectionDatabase(
  dbPath: string,
): Promise<Result<AnkiRawCollectionData, AppError>> {
  let db: SQLiteDatabase | null = null;

  try {
    db = await openDatabaseAsync(dbPath);

    const notesTable = db.getFirstSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notes'",
    );
    const cardsTable = db.getFirstSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cards'",
    );
    const colTable = db.getFirstSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'col'",
    );

    if (!notesTable || !cardsTable || !colTable) {
      return ankiInvalidFileError('Anki collection database is missing required tables');
    }

    const notes = db.getAllSync<AnkiRawCollectionData['notes'][number]>(
      'SELECT id, guid, mid, flds, sfld, tags FROM notes',
    );
    const cards = db.getAllSync<AnkiRawCollectionData['cards'][number]>(
      'SELECT id, nid, did, ivl, factor, reps, lapses, queue, type FROM cards',
    );
    const colRow = db.getFirstSync<{ decks: string }>('SELECT decks FROM col LIMIT 1');

    return {
      ok: true,
      value: {
        notes,
        cards,
        decksJson: colRow?.decks ?? null,
      },
    };
  } catch (cause) {
    return ankiDbReadError('Failed to query Anki collection database', cause);
  } finally {
    await db?.closeAsync();
  }
}

export async function readAnkiApkgFile(
  filePath: string,
  deps: AnkiFileReaderDeps = {},
): Promise<Result<AnkiParseResult, AppError>> {
  const readFileBase64 = deps.readFileBase64 ?? defaultReadFileBase64;
  const unzipArchive = deps.unzipArchive ?? defaultUnzipArchive;
  const queryCollectionDatabase = deps.queryCollectionDatabase ?? defaultQueryCollectionDatabase;
  const makeTempDir = deps.makeTempDir ?? defaultMakeTempDir;
  const deletePath = deps.deletePath ?? defaultDeletePath;

  const tempDir = makeTempDir();
  let extractedDbPath: string | null = null;

  try {
    const base64 = await readFileBase64(filePath);
    const unzipResult = await unzipArchive(base64, tempDir);
    if (!unzipResult.ok) {
      return unzipResult;
    }

    const collectionFileNames = listCollectionDbFileNames(unzipResult.value);
    if (collectionFileNames.length === 0) {
      return ankiInvalidFileError('Anki collection database not found in archive');
    }

    let lastQueryResult: Result<AnkiRawCollectionData, AppError> | null = null;

    for (const collectionFileName of collectionFileNames) {
      extractedDbPath = `${tempDir}${collectionFileName}`;
      const queryResult = await queryCollectionDatabase(extractedDbPath);
      if (queryResult.ok) {
        return parseAnkiCollection(queryResult.value);
      }

      lastQueryResult = queryResult;
      if (queryResult.error.code !== 'anki_db_read_failed') {
        return queryResult;
      }
    }

    return lastQueryResult ?? ankiInvalidFileError('Failed to read Anki collection database');
  } catch (cause) {
    return ankiInvalidFileError('Failed to read Anki deck file', cause);
  } finally {
    if (extractedDbPath) {
      await deletePath(extractedDbPath, { idempotent: true }).catch(() => undefined);
    }
    await deletePath(tempDir, { idempotent: true }).catch(() => undefined);
  }
}

export async function cleanupAnkiImportFile(
  filePath: string,
  deps: AnkiFileReaderDeps = {},
): Promise<void> {
  const deletePath = deps.deletePath ?? defaultDeletePath;
  await deletePath(filePath, { idempotent: true }).catch(() => undefined);
}
