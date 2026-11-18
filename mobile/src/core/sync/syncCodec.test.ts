import * as pako from 'pako';

import type { BackupData } from '@/core/backup/backup.types';
import { buildBackupBundle, serializeBackupBundle } from '@/core/backup/backupSerializer';
import { decodeSyncFile, encodeSyncFile } from '@/core/sync/syncCodec';
import { toSyncData } from '@/core/sync/syncFile';
import { emptySyncData, fullSampleData } from '@/core/sync/syncSamples.testutil';

const ENVELOPE = {
  schemaVersion: 22,
  curriculumVersion: '1.4.0',
  exportedAt: '2026-11-16T10:00:00.000Z',
};

// The server envelope check of Task 7.
const SERVER_ENVELOPE =
  /^\{"format":"pakapaka-backup","formatVersion":1,"schemaVersion":\d+,"curriculumVersion":(null|"[^"]*"),"exportedAt":"[^"]*","includesConversations":false,"data":\{/;

/** Full sample plus a srsStates table of 1,201 rows (three chunks). */
function bigSample(): BackupData {
  const data = fullSampleData();
  const template = data.srsStates[0];
  data.srsStates = Array.from({ length: 1201 }, (_, index) => ({
    ...template,
    item: { itemType: 'vocabulary' as const, slug: `word-${index}` },
  }));
  return data;
}

function gzipOf(value: unknown): Uint8Array {
  return pako.gzip(JSON.stringify(value));
}

describe('syncCodec', () => {
  it('encoded text equals the backup serializer output', async () => {
    const data = bigSample();
    const encoded = await encodeSyncFile(ENVELOPE, data);
    const expected = serializeBackupBundle(
      buildBackupBundle({ ...ENVELOPE, includesConversations: false }, toSyncData(data)),
    );
    expect(pako.ungzip(encoded, { to: 'string' })).toBe(expected);
  });

  it('the first 300 characters match the server envelope pattern', async () => {
    const encoded = await encodeSyncFile(ENVELOPE, fullSampleData());
    const text = pako.ungzip(encoded, { to: 'string' });
    expect(text.slice(0, 300)).toMatch(SERVER_ENVELOPE);
  });

  it('decode(encode(x)) returns x', async () => {
    const data = bigSample();
    const decoded = await decodeSyncFile(await encodeSyncFile(ENVELOPE, data));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.data).toEqual(toSyncData(data));
    expect(decoded.value.schemaVersion).toBe(22);
    expect(decoded.value.curriculumVersion).toBe('1.4.0');
    expect(decoded.value.includesConversations).toBe(false);
  });

  it('decode strips never-synced preferences and AI rows found in a remote file', async () => {
    const data = fullSampleData();
    data.userPreferences.push({ key: 'theme_mode', value: 'dark', updatedAt: '2026-11-01T00:00:00.000Z' });
    data.aiSessions = [
      {
        id: 's1',
        provider: 'openai',
        model: 'm',
        mode: 'free',
        topicItem: null,
        topicItems: [],
        startedAt: '2026-11-01T00:00:00.000Z',
        endedAt: null,
        endedReason: null,
        turnCount: 1,
        summaryJson: null,
        summaryGeneratedAt: null,
      },
    ];
    data.aiMessages = [
      { id: 'm1', sessionId: 's1', role: 'user', content: 'hi', createdAt: '2026-11-01T00:00:00.000Z' },
    ];
    const bundle = buildBackupBundle({ ...ENVELOPE, includesConversations: false }, data);
    const decoded = await decodeSyncFile(gzipOf(bundle));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.data.userPreferences.map((row) => row.key)).toEqual(['session_intensity']);
    expect(decoded.value.data.aiSessions).toEqual([]);
    expect(decoded.value.data.aiMessages).toEqual([]);
  });

  it('decode of non-gzip bytes → sync_bad_file', async () => {
    const decoded = await decodeSyncFile(new TextEncoder().encode('not a gzip file'));
    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.error.code).toBe('sync_bad_file');
  });

  it('decode of a file with formatVersion 2 → sync_update_required', async () => {
    const bundle = { ...buildBackupBundle({ ...ENVELOPE, includesConversations: false }, emptySyncData()), formatVersion: 2 };
    const decoded = await decodeSyncFile(gzipOf(bundle));
    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.error.code).toBe('sync_update_required');
  });

  it('decode of a row with a wrong type → sync_bad_file', async () => {
    const data = fullSampleData();
    (data.srsStates[0] as unknown as Record<string, unknown>).reps = 'three';
    const bundle = buildBackupBundle({ ...ENVELOPE, includesConversations: false }, data);
    const decoded = await decodeSyncFile(gzipOf(bundle));
    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.error.code).toBe('sync_bad_file');
  });

  it('encode yields between chunks', async () => {
    jest.useFakeTimers();
    try {
      let done = false;
      const promise = encodeSyncFile(ENVELOPE, bigSample()).then((bytes) => {
        done = true;
        return bytes;
      });
      for (let i = 0; i < 20; i += 1) await Promise.resolve();
      expect(done).toBe(false);
      await jest.runAllTimersAsync();
      const bytes = await promise;
      expect(done).toBe(true);
      expect(bytes.length).toBeGreaterThan(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
