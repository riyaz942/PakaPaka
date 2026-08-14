import type { BackupData } from '@/core/backup/backup.types';
import { validateBackupData } from '@/core/backup/backupValidator';

function emptyData(): BackupData {
  return {
    userPreferences: [],
    itemStudyStatus: [],
    srsStates: [],
    importMetadata: [],
    personalMnemonics: [],
    relatedItemBoosts: [],
    weaknessStats: [],
    cognitiveLoadHistory: [],
    streaks: [],
    userSynonyms: [],
    dailyLessonLog: [],
    goalRingState: [],
    furiganaOverrides: [],
    cardSeen: [],
    passagePracticeResults: [],
    aiSessions: [],
    aiMessages: [],
  };
}

describe('validateBackupData', () => {
  it('accepts an empty bundle', () => {
    expect(validateBackupData(emptyData()).ok).toBe(true);
  });

  it('accepts well-formed item-keyed rows', () => {
    const data = emptyData();
    data.itemStudyStatus = [
      { item: { itemType: 'kanji', slug: 'sun' }, status: 'known', updatedAt: '2026-08-01T00:00:00.000Z' },
    ];
    expect(validateBackupData(data).ok).toBe(true);
  });

  it('rejects a null row', () => {
    const data = emptyData();
    (data.cardSeen as unknown[])[0] = null;

    const result = validateBackupData(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_SHAPE');
    expect(result.error.message).toMatch(/cardSeen/);
  });

  it('rejects a non-object row', () => {
    const data = emptyData();
    (data.userPreferences as unknown[])[0] = 'not-a-row';

    const result = validateBackupData(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_SHAPE');
  });

  it('rejects an item-keyed row with a missing item ref', () => {
    const data = emptyData();
    (data.srsStates as unknown[])[0] = { stability: 1, difficulty: 2 };

    const result = validateBackupData(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_SHAPE');
    expect(result.error.message).toMatch(/srsStates/);
  });

  it('rejects an item ref whose slug is not a string', () => {
    const data = emptyData();
    (data.furiganaOverrides as unknown[])[0] = {
      item: { itemType: 'vocabulary', slug: 42 },
      displayMode: 'shown',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };

    const result = validateBackupData(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_SHAPE');
  });

  it('rejects an ai session whose topicItems entry is not an item ref', () => {
    const data = emptyData();
    (data.aiSessions as unknown[])[0] = {
      id: 's1',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      mode: 'random',
      topicItem: null,
      topicItems: ['kanji:sun'],
      startedAt: '2026-08-01T00:00:00.000Z',
      endedAt: null,
      endedReason: null,
      turnCount: 0,
      summaryJson: null,
      summaryGeneratedAt: null,
    };

    const result = validateBackupData(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_SHAPE');
  });

  it('rejects an ai session that omits topicItems', () => {
    const data = emptyData();
    (data.aiSessions as unknown[])[0] = {
      id: 's1',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      mode: 'random',
      topicItem: null,
      startedAt: '2026-08-01T00:00:00.000Z',
      endedAt: null,
      endedReason: null,
      turnCount: 0,
      summaryJson: null,
      summaryGeneratedAt: null,
    };

    const result = validateBackupData(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_SHAPE');
  });

  it('accepts an ai session with a null topicItem', () => {
    const data = emptyData();
    data.aiSessions = [
      {
        id: 's1',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        mode: 'random',
        topicItem: null,
        topicItems: [],
        startedAt: '2026-08-01T00:00:00.000Z',
        endedAt: null,
        endedReason: null,
        turnCount: 0,
        summaryJson: null,
        summaryGeneratedAt: null,
      },
    ];
    expect(validateBackupData(data).ok).toBe(true);
  });

  it('ignores unknown extra tables so a newer export still restores', () => {
    const data = emptyData() as BackupData & { futureTable?: unknown };
    data.futureTable = [{ anything: true }];
    expect(validateBackupData(data).ok).toBe(true);
  });
});
