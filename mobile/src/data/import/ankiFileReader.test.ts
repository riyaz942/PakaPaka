import { readAnkiApkgFile } from '@/data/import/ankiFileReader';
import type { AnkiRawCollectionData } from '@/core/import/ankiParser';

describe('ankiFileReader', () => {
  const filePath = 'file:///mock-documents/deck.apkg';
  const tempDir = 'file:///mock-documents/anki-import-temp/';

  const collectionData: AnkiRawCollectionData = {
    notes: [
      {
        id: 1,
        guid: 'abc',
        mid: 1,
        flds: '水',
        sfld: '水',
        tags: '',
      },
    ],
    cards: [
      {
        id: 1,
        nid: 1,
        did: 1,
        ivl: 3,
        factor: 2500,
        reps: 2,
        lapses: 0,
        queue: 2,
        type: 2,
      },
    ],
    decksJson: JSON.stringify({ '1': { name: 'Core' } }),
  };

  it('reads and parses a valid apkg file', async () => {
    const deletedPaths: string[] = [];

    const result = await readAnkiApkgFile(filePath, {
      readFileBase64: async () => 'ZmFrZS16aXA=',
      makeTempDir: () => tempDir,
      unzipArchive: async () => ({
        ok: true,
        value: ['collection.anki21', 'media'],
      }),
      queryCollectionDatabase: async () => ({ ok: true, value: collectionData }),
      deletePath: async (uri) => {
        deletedPaths.push(uri);
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deckName).toBe('Core');
      expect(result.value.notes).toHaveLength(1);
    }
    expect(deletedPaths).toEqual(
      expect.arrayContaining([
        `${tempDir}collection.anki21`,
        tempDir,
      ]),
    );
  });

  it('returns a user-friendly error for corrupt zip archives', async () => {
    const result = await readAnkiApkgFile(filePath, {
      readFileBase64: async () => 'not-a-zip',
      makeTempDir: () => tempDir,
      unzipArchive: async () => ({
        ok: false,
        error: {
          code: 'anki_invalid_file',
          message: 'Failed to extract Anki archive',
          userMessage:
            "This file doesn't appear to be a valid Anki deck. Make sure you're selecting an .apkg file exported from Anki.",
        },
      }),
      deletePath: async () => undefined,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('anki_invalid_file');
      expect(result.error.userMessage).toContain('valid Anki deck');
    }
  });

  it('returns an error when the collection database is missing from the archive', async () => {
    const result = await readAnkiApkgFile(filePath, {
      readFileBase64: async () => 'ZmFrZQ==',
      makeTempDir: () => tempDir,
      unzipArchive: async () => ({ ok: true, value: ['media', 'meta'] }),
      deletePath: async () => undefined,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('anki_invalid_file');
    }
  });

  it('cleans up temp files when database query fails', async () => {
    const deletedPaths: string[] = [];

    const result = await readAnkiApkgFile(filePath, {
      readFileBase64: async () => 'ZmFrZQ==',
      makeTempDir: () => tempDir,
      unzipArchive: async () => ({ ok: true, value: ['collection.anki2'] }),
      queryCollectionDatabase: async () => ({
        ok: false,
        error: {
          code: 'anki_db_read_failed',
          message: 'Failed to query Anki collection database',
          userMessage: 'Could not read the deck database. The file may be corrupted.',
        },
      }),
      deletePath: async (uri) => {
        deletedPaths.push(uri);
      },
    });

    expect(result.ok).toBe(false);
    expect(deletedPaths).toEqual(
      expect.arrayContaining([
        `${tempDir}collection.anki2`,
        tempDir,
      ]),
    );
  });

  it('falls back to a legacy collection database when the newest file cannot be read', async () => {
    const queriedPaths: string[] = [];

    const result = await readAnkiApkgFile(filePath, {
      readFileBase64: async () => 'ZmFrZQ==',
      makeTempDir: () => tempDir,
      unzipArchive: async () => ({
        ok: true,
        value: ['collection.anki21b', 'collection.anki21', 'collection.anki2'],
      }),
      queryCollectionDatabase: async (dbPath) => {
        queriedPaths.push(dbPath);
        if (dbPath.endsWith('collection.anki21b')) {
          return {
            ok: false,
            error: {
              code: 'anki_db_read_failed',
              message: 'Failed to query Anki collection database',
              userMessage: 'Could not read the deck database. The file may be corrupted.',
            },
          };
        }
        return { ok: true, value: collectionData };
      },
      deletePath: async () => undefined,
    });

    expect(result.ok).toBe(true);
    expect(queriedPaths).toEqual([
      `${tempDir}collection.anki21b`,
      `${tempDir}collection.anki21`,
    ]);
  });
});
