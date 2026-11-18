import { PREFERENCE_KEYS } from '@/data/user/preferencesRepository';

import { SYNC_TABLE_KEYS } from './sync.types';
import {
  itemKeyOf,
  NEVER_SYNCED_PREFERENCE_KEYS,
  rowKey,
  rowsEqual,
  SYNC_TABLES,
} from './syncTables';
import { validateSyncData } from './syncFile';
import { fullSampleData } from './syncSamples.testutil';

describe('SYNC_TABLES', () => {
  it('every sync table has a descriptor and every field of its entry type', () => {
    expect(Object.keys(SYNC_TABLES).sort()).toEqual([...SYNC_TABLE_KEYS].sort());
    expect(SYNC_TABLE_KEYS).toHaveLength(18);

    const sample = fullSampleData();
    for (const table of SYNC_TABLE_KEYS) {
      const row = sample[table][0] as unknown as Record<string, unknown>;
      const { fields, ignored } = SYNC_TABLES[table];
      // The descriptor names exactly the fields the entry type has.
      expect(Object.keys(fields).sort()).toEqual(Object.keys(row).sort());
      for (const name of ignored) expect(fields).toHaveProperty(name);
    }
    // The shipped validator checks every field type of every row against the descriptors.
    expect(validateSyncData(sample).ok).toBe(true);
  });
});

describe('rowsEqual', () => {
  const srs = fullSampleData().srsStates[0];

  it('ignores updatedAt', () => {
    expect(rowsEqual('srsStates', srs, { ...srs, updatedAt: '2030-01-01T00:00:00.000Z' })).toBe(true);
    expect(rowsEqual('srsStates', srs, { ...srs, reps: srs.reps + 1 })).toBe(false);
  });

  it('ignores createdAt for userSynonyms, optedInAt for lessonOptIns, seenAt for cardSeen', () => {
    const sample = fullSampleData();
    const later = '2030-01-01T00:00:00.000Z';
    const synonym = sample.userSynonyms[0];
    const grammarAnswer = sample.grammarAnswers[0];
    const optIn = sample.lessonOptIns[0];
    const seen = sample.cardSeen[0];
    expect(rowsEqual('userSynonyms', synonym, { ...synonym, createdAt: later })).toBe(true);
    expect(rowsEqual('grammarAnswers', grammarAnswer, { ...grammarAnswer, createdAt: later })).toBe(true);
    expect(rowsEqual('lessonOptIns', optIn, { ...optIn, optedInAt: later })).toBe(true);
    expect(rowsEqual('cardSeen', seen, { ...seen, seenAt: later })).toBe(true);
    expect(rowsEqual('userSynonyms', synonym, { ...synonym, answerText: 'dog' })).toBe(false);
  });

  it('compares sentenceKeys in order', () => {
    const row = fullSampleData().grammarSentenceHistory[0];
    expect(rowsEqual('grammarSentenceHistory', { ...row, sentenceKeys: ['a', 'b'] }, { ...row, sentenceKeys: ['a', 'b'] })).toBe(true);
    expect(rowsEqual('grammarSentenceHistory', { ...row, sentenceKeys: ['a', 'b'] }, { ...row, sentenceKeys: ['b', 'a'] })).toBe(false);
    expect(rowsEqual('grammarSentenceHistory', { ...row, sentenceKeys: ['a'] }, { ...row, sentenceKeys: ['a', 'b'] })).toBe(false);
  });

  it('compares item refs and nullable fields by value', () => {
    expect(rowsEqual('srsStates', srs, { ...srs, item: { ...srs.item } })).toBe(true);
    expect(rowsEqual('srsStates', srs, { ...srs, item: { ...srs.item, slug: 'inu' } })).toBe(false);
    expect(rowsEqual('srsStates', srs, { ...srs, lastReviewedAt: '2026-11-02T00:00:00.000Z' })).toBe(false);
  });

  it('treats a missing row as a value', () => {
    expect(rowsEqual('srsStates', undefined, undefined)).toBe(true);
    expect(rowsEqual('srsStates', srs, undefined)).toBe(false);
    expect(rowsEqual('srsStates', undefined, srs)).toBe(false);
  });
});

describe('rowKey', () => {
  const sample = fullSampleData();

  it('keys a userSynonyms row by item, answerType and answerText', () => {
    const row = sample.userSynonyms[0];
    expect(rowKey('userSynonyms', row)).toBe('vocabulary:neko|meaning|cat');
    expect(rowKey('userSynonyms', { ...row, answerText: 'kitty' })).not.toBe(rowKey('userSynonyms', row));
  });

  it('never collides when a part contains |', () => {
    const row = fullSampleData().grammarAnswers[0];
    const left = rowKey('grammarAnswers', { ...row, sentenceKey: 'A', answerText: 'B|C' });
    const right = rowKey('grammarAnswers', { ...row, sentenceKey: 'A|B', answerText: 'C' });
    expect(left).not.toBe(right);
    const slashed = rowKey('grammarAnswers', { ...row, sentenceKey: 'A\\', answerText: '|B' });
    const plain = rowKey('grammarAnswers', { ...row, sentenceKey: 'A', answerText: '\\|B' });
    expect(slashed).not.toBe(plain);
  });

  it('keys importMetadata by source and importedAt', () => {
    const row = sample.importMetadata[0];
    expect(rowKey('importMetadata', row)).toBe(`anki|${row.importedAt}`);
  });

  it('keys the other tables as the approved decisions say', () => {
    expect(rowKey('userPreferences', sample.userPreferences[0])).toBe('session_intensity');
    expect(rowKey('srsStates', sample.srsStates[0])).toBe('vocabulary:neko');
    expect(rowKey('relatedItemBoosts', sample.relatedItemBoosts[0])).toBe('vocabulary:neko');
    expect(rowKey('grammarAnswers', sample.grammarAnswers[0])).toBe('vocabulary:neko|猫がいる|猫がいます');
    expect(rowKey('cardSeen', sample.cardSeen[0])).toBe('welcome');
    expect(rowKey('passagePracticeResults', sample.passagePracticeResults[0])).toBe('7|21');
    expect(rowKey('dailyLessonLog', sample.dailyLessonLog[0])).toBe('2026-11-01');
    expect(rowKey('cognitiveLoadHistory', sample.cognitiveLoadHistory[0])).toBe('2026-11-01');
    expect(rowKey('streaks', sample.streaks[0])).toBe('1');
    expect(rowKey('goalRingState', sample.goalRingState[0])).toBe('1');
  });
});

describe('itemKeyOf', () => {
  const sample = fullSampleData();

  it('returns the item key for per-item and boost tables', () => {
    expect(itemKeyOf('srsStates', sample.srsStates[0])).toBe('vocabulary:neko');
    expect(itemKeyOf('userSynonyms', sample.userSynonyms[0])).toBe('vocabulary:neko');
    expect(itemKeyOf('relatedItemBoosts', sample.relatedItemBoosts[0])).toBe('vocabulary:neko');
  });

  it('returns null for other kinds', () => {
    expect(itemKeyOf('userPreferences', sample.userPreferences[0])).toBeNull();
    expect(itemKeyOf('cardSeen', sample.cardSeen[0])).toBeNull();
    expect(itemKeyOf('passagePracticeResults', sample.passagePracticeResults[0])).toBeNull();
    expect(itemKeyOf('dailyLessonLog', sample.dailyLessonLog[0])).toBeNull();
    expect(itemKeyOf('streaks', sample.streaks[0])).toBeNull();
  });
});

describe('descriptor kinds', () => {
  it('match the approved decisions', () => {
    const kinds = Object.fromEntries(SYNC_TABLE_KEYS.map((table) => [table, SYNC_TABLES[table].kind]));
    expect(kinds).toEqual({
      userPreferences: 'preference',
      itemStudyStatus: 'per_item',
      srsStates: 'per_item',
      weaknessStats: 'per_item',
      personalMnemonics: 'per_item',
      furiganaOverrides: 'per_item',
      grammarSentenceHistory: 'per_item',
      lessonOptIns: 'per_item',
      userSynonyms: 'per_item',
      grammarAnswers: 'per_item',
      relatedItemBoosts: 'boost',
      cardSeen: 'append_only',
      importMetadata: 'append_only',
      passagePracticeResults: 'passage',
      dailyLessonLog: 'per_day',
      cognitiveLoadHistory: 'per_day',
      streaks: 'singleton',
      goalRingState: 'singleton',
    });
  });
});

describe('NEVER_SYNCED_PREFERENCE_KEYS', () => {
  it('holds the 15 keys of the approved decision, built from PREFERENCE_KEYS', () => {
    const expected = [
      PREFERENCE_KEYS.installedCurriculumVersion,
      PREFERENCE_KEYS.installedCurriculumContentHash,
      PREFERENCE_KEYS.curriculumUpdateSource,
      PREFERENCE_KEYS.lastBackedUpAt,
      PREFERENCE_KEYS.aiOpenAiBaseUrl,
      PREFERENCE_KEYS.aiActiveProvider,
      PREFERENCE_KEYS.aiOpenAiModel,
      PREFERENCE_KEYS.aiAnthropicModel,
      PREFERENCE_KEYS.cloudSttOptIn,
      PREFERENCE_KEYS.wordTranslateOptIn,
      PREFERENCE_KEYS.notificationsEnabled,
      PREFERENCE_KEYS.notificationReminderTime,
      PREFERENCE_KEYS.reducedMotion,
      PREFERENCE_KEYS.themeMode,
      PREFERENCE_KEYS.hapticsEnabled,
    ];
    expect(NEVER_SYNCED_PREFERENCE_KEYS.size).toBe(15);
    expect([...NEVER_SYNCED_PREFERENCE_KEYS].sort()).toEqual([...expected].sort());
    expect(NEVER_SYNCED_PREFERENCE_KEYS.has('session_intensity')).toBe(false);
  });
});
