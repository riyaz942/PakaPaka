import type { BackupData } from '@/core/backup/backup.types';

import { toSyncData, validateSyncData } from './syncFile';
import { fullSampleData } from './syncSamples.testutil';
import { NEVER_SYNCED_PREFERENCE_KEYS } from './syncTables';

const AT = '2026-11-01T00:00:00.000Z';

describe('toSyncData', () => {
  it.each([...NEVER_SYNCED_PREFERENCE_KEYS])('removes each never-synced key: %s', (key) => {
    const data = fullSampleData();
    data.userPreferences = [
      { key, value: 'x', updatedAt: AT },
      { key: 'starting_jlpt_level', value: 'N5', updatedAt: AT },
    ];
    const result = toSyncData(data);
    expect(result.userPreferences.map((row) => row.key)).toEqual(['starting_jlpt_level']);
  });

  it('keeps session_intensity, home_layout, vacation_started_at', () => {
    const data = fullSampleData();
    data.userPreferences = ['session_intensity', 'home_layout', 'vacation_started_at'].map((key) => ({
      key,
      value: 'x',
      updatedAt: AT,
    }));
    expect(toSyncData(data).userPreferences.map((row) => row.key)).toEqual([
      'session_intensity',
      'home_layout',
      'vacation_started_at',
    ]);
  });

  it('empties aiSessions and aiMessages', () => {
    const data = fullSampleData();
    data.aiSessions = [
      {
        id: 's1',
        provider: 'openai',
        model: 'm',
        mode: 'chat',
        topicItem: null,
        topicItems: [],
        startedAt: AT,
        endedAt: null,
        endedReason: null,
        turnCount: 1,
        summaryJson: null,
        summaryGeneratedAt: null,
      },
    ];
    data.aiMessages = [{ id: 'm1', sessionId: 's1', role: 'user', content: 'hi', createdAt: AT }];
    const result = toSyncData(data);
    expect(result.aiSessions).toEqual([]);
    expect(result.aiMessages).toEqual([]);
  });

  it('returns a copy and leaves the input unchanged', () => {
    const data = fullSampleData();
    data.userPreferences = [{ key: 'theme_mode', value: 'dark', updatedAt: AT }];
    const result = toSyncData(data);
    expect(result).not.toBe(data);
    expect(data.userPreferences).toHaveLength(1);
    expect(result.srsStates).toEqual(data.srsStates);
  });
});

describe('validateSyncData', () => {
  it('accepts a valid full sample', () => {
    const result = validateSyncData(fullSampleData());
    expect(result.ok).toBe(true);
  });

  it('rejects a wrong field type', () => {
    const data = fullSampleData();
    (data.srsStates[0] as unknown as Record<string, unknown>).reps = '3';
    const result = validateSyncData(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sync_bad_file');
  });

  it('rejects a missing field', () => {
    const data = fullSampleData();
    delete (data.cardSeen[0] as Partial<BackupData['cardSeen'][number]>).seenAt;
    const result = validateSyncData(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sync_bad_file');
  });

  it('rejects two rows with the same key', () => {
    const data = fullSampleData();
    data.srsStates.push({ ...data.srsStates[0], reps: 9 });
    const result = validateSyncData(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sync_bad_file');
  });

  it('rejects a null where the field cannot be null', () => {
    const data = fullSampleData();
    (data.srsStates[0] as unknown as Record<string, unknown>).dueDate = null;
    const result = validateSyncData(data);
    expect(result.ok).toBe(false);
  });

  it('rejects a row that is not an object, with the sync code', () => {
    const data = fullSampleData();
    (data.cardSeen as unknown[])[0] = null;
    const result = validateSyncData(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sync_bad_file');
  });

  it('rejects a table that is not an array', () => {
    const data = fullSampleData() as unknown as Record<string, unknown>;
    delete data.streaks;
    const result = validateSyncData(data as unknown as BackupData);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sync_bad_file');
  });

  it('rejects sentenceKeys that is not a string list', () => {
    const data = fullSampleData();
    (data.grammarSentenceHistory[0] as unknown as Record<string, unknown>).sentenceKeys = ['a', 2];
    expect(validateSyncData(data).ok).toBe(false);
  });

  it('rejects a non-finite number', () => {
    const data = fullSampleData();
    data.srsStates[0].stability = Number.NaN;
    expect(validateSyncData(data).ok).toBe(false);
  });
});
