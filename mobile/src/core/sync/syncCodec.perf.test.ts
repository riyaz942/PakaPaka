import type { BackupData, ItemRef } from '@/core/backup/backup.types';
import { decodeSyncFile, encodeSyncFile } from '@/core/sync/syncCodec';
import { emptySyncData, fullSampleData } from '@/core/sync/syncSamples.testutil';

const AT = '2026-11-01T00:00:00.000Z';

/** A user with `items` studied items: one row per item in the four big tables, fewer in the rest. */
function sampleWithItems(items: number): BackupData {
  const sample = fullSampleData();
  const data = emptySyncData();
  const itemAt = (index: number): ItemRef => ({ itemType: 'vocabulary', slug: `word-${index}` });
  const range = (count: number) => Array.from({ length: count }, (_, index) => index);

  data.srsStates = range(items).map((index) => ({ ...sample.srsStates[0], item: itemAt(index) }));
  data.itemStudyStatus = range(items).map((index) => ({ item: itemAt(index), status: 'known', updatedAt: AT }));
  data.weaknessStats = range(items).map((index) => ({ ...sample.weaknessStats[0], item: itemAt(index) }));
  data.relatedItemBoosts = range(items).map((index) => ({ item: itemAt(index), boost: 0.5, updatedAt: AT }));
  data.personalMnemonics = range(Math.ceil(items / 10)).map((index) => ({
    item: itemAt(index),
    mnemonicText: `mnemonic ${index}`,
    updatedAt: AT,
  }));
  data.grammarSentenceHistory = range(Math.ceil(items / 10)).map((index) => ({
    item: itemAt(index),
    sentenceKeys: ['a', 'b'],
    updatedAt: AT,
  }));
  data.cognitiveLoadHistory = range(365).map((index) => ({
    date: `2026-01-${String(index).padStart(3, '0')}`,
    load: 12,
    threshold: 40,
    updatedAt: AT,
  }));
  data.dailyLessonLog = range(365).map((index) => ({ date: `2026-01-${String(index).padStart(3, '0')}`, itemsStarted: 3 }));
  data.userPreferences = sample.userPreferences;
  data.streaks = sample.streaks;
  data.goalRingState = sample.goalRingState;
  return data;
}

describe('syncCodec timing', () => {
  it.each([1500, 12700])('encodes and decodes a %i-item file', async (items) => {
    const data = sampleWithItems(items);
    const envelope = { schemaVersion: 22, curriculumVersion: '1.4.0', exportedAt: AT };

    const encodeStart = Date.now();
    const bytes = await encodeSyncFile(envelope, data);
    const encodeMs = Date.now() - encodeStart;

    const decodeStart = Date.now();
    const decoded = await decodeSyncFile(bytes);
    const decodeMs = Date.now() - decodeStart;

    expect(decoded.ok).toBe(true);
    console.info(`sync codec ${items} items: encode ${encodeMs} ms, decode ${decodeMs} ms, ${bytes.length} gzip bytes`);
  });
});
