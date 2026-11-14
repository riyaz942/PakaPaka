import {
  buildBackupBundle,
  parseBackupBundle,
  serializeBackupBundle,
} from '@/core/backup/backupSerializer';
import { BACKUP_DATA_KEYS, type BackupData } from '@/core/backup/backup.types';

function seededData(): BackupData {
  return {
    userPreferences: [{ key: 'theme_mode', value: 'dark', updatedAt: '2026-08-01T00:00:00.000Z' }],
    itemStudyStatus: [
      {
        item: { itemType: 'kanji', slug: 'sun' },
        status: 'in_progress',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    srsStates: [
      {
        item: { itemType: 'kanji', slug: 'sun' },
        stability: 2.5,
        difficulty: 4.1,
        dueDate: '2026-08-05T00:00:00.000Z',
        fsrsState: 'review',
        reps: 3,
        lapses: 0,
        learningSteps: 0,
        isBurned: false,
        srsStageLabel: 'guru',
        lastReviewedAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    importMetadata: [
      { source: 'wanikani', importedAt: '2026-07-01T00:00:00.000Z', mappedCount: 10, unmatchedCount: 2 },
    ],
    personalMnemonics: [
      {
        item: { itemType: 'kanji', slug: 'sun' },
        mnemonicText: 'A window with a line through it.',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    relatedItemBoosts: [
      { item: { itemType: 'kanji', slug: 'sun' }, boost: 0.5, updatedAt: '2026-08-01T00:00:00.000Z' },
    ],
    weaknessStats: [
      {
        item: { itemType: 'kanji', slug: 'sun' },
        correctCount: 5,
        incorrectCount: 1,
        typoCount: 0,
        lastErrorAt: null,
        lastErrorType: null,
        patternTags: null,
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    cognitiveLoadHistory: [
      { date: '2026-08-01', load: 12, threshold: 20, updatedAt: '2026-08-01T00:00:00.000Z' },
    ],
    streaks: [
      {
        currentStreak: 4,
        longestStreak: 10,
        lastReviewDate: '2026-08-01',
        lastCelebratedDate: null,
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    userSynonyms: [
      {
        item: { itemType: 'kanji', slug: 'sun' },
        answerType: 'meaning',
        answerText: 'day',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    dailyLessonLog: [{ date: '2026-08-01', itemsStarted: 3 }],
    goalRingState: [
      {
        dailyGoalTarget: 20,
        goalWeekStart: '2026-07-27',
        consecutiveMissWeeks: 0,
        pendingRiseTo: null,
        pendingReductionTo: null,
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    furiganaOverrides: [
      {
        item: { itemType: 'vocabulary', slug: 'nichiyoubi' },
        displayMode: 'hidden',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    cardSeen: [{ cardId: 'srs-explainer', seenAt: '2026-08-01T00:00:00.000Z' }],
    passagePracticeResults: [
      {
        passageId: '7',
        questionId: '21',
        isCorrect: true,
        userAnswer: 'こたえ',
        answeredAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    grammarAnswers: [
      {
        item: { itemType: 'grammar', slug: 'kara-because' },
        sentenceKey: '寒いから、コートを着ます。',
        answerText: 'さむいからこーときます',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    grammarSentenceHistory: [
      {
        item: { itemType: 'grammar', slug: 'kara-because' },
        sentenceKeys: ['S1', 'S2'],
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    aiSessions: [],
    aiMessages: [],
  };
}

describe('buildBackupBundle / serializeBackupBundle / parseBackupBundle round trip', () => {
  it('produces identical rows on every covered table after a string round trip', () => {
    const data = seededData();
    const bundle = buildBackupBundle(
      {
        schemaVersion: 19,
        curriculumVersion: '1.4.0',
        exportedAt: '2026-08-13T00:00:00.000Z',
        includesConversations: false,
      },
      data,
    );

    const json = serializeBackupBundle(bundle);
    const result = parseBackupBundle(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.format).toBe('pakapaka-backup');
    expect(result.value.formatVersion).toBe(1);
    expect(result.value.schemaVersion).toBe(19);
    expect(result.value.curriculumVersion).toBe('1.4.0');
    expect(result.value.includesConversations).toBe(false);

    for (const key of BACKUP_DATA_KEYS) {
      expect(result.value.data[key]).toEqual(data[key]);
    }
  });

  it('carries includesConversations through when AI transcripts are included', () => {
    const data = seededData();
    data.aiSessions = [
      {
        id: 'session-1',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        mode: 'random',
        topicItem: null,
        topicItems: [],
        startedAt: '2026-08-01T00:00:00.000Z',
        endedAt: '2026-08-01T00:05:00.000Z',
        endedReason: 'user_end',
        turnCount: 2,
        summaryJson: null,
        summaryGeneratedAt: null,
      },
    ];
    data.aiMessages = [
      {
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'user',
        content: 'こんにちは',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ];

    const bundle = buildBackupBundle(
      {
        schemaVersion: 19,
        curriculumVersion: '1.4.0',
        exportedAt: '2026-08-13T00:00:00.000Z',
        includesConversations: true,
      },
      data,
    );

    const result = parseBackupBundle(serializeBackupBundle(bundle));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.includesConversations).toBe(true);
    expect(result.value.data.aiSessions).toEqual(data.aiSessions);
    expect(result.value.data.aiMessages).toEqual(data.aiMessages);
  });
});

describe('parseBackupBundle validation', () => {
  it('rejects non-JSON input with a typed AppError', () => {
    const result = parseBackupBundle('not json{{{');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_JSON');
  });

  it('rejects a mismatched format string', () => {
    const result = parseBackupBundle(JSON.stringify({ format: 'something-else' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_FORMAT_MISMATCH');
    expect(result.error.userMessage).toBe('That file is not a PakaPaka backup.');
  });

  it('rejects an unsupported formatVersion', () => {
    const result = parseBackupBundle(
      JSON.stringify({ format: 'pakapaka-backup', formatVersion: 2 }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_VERSION_UNSUPPORTED');
    expect(result.error.userMessage).toMatch(/newer version/i);
  });

  it('rejects a payload missing the data object', () => {
    const result = parseBackupBundle(
      JSON.stringify({
        format: 'pakapaka-backup',
        formatVersion: 1,
        schemaVersion: 19,
        exportedAt: '2026-08-13T00:00:00.000Z',
        includesConversations: false,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BACKUP_INVALID_SHAPE');
  });

  it('defaults curriculumVersion to null when absent', () => {
    const data = seededData();
    const bundle = buildBackupBundle(
      { schemaVersion: 19, curriculumVersion: null, exportedAt: '2026-08-13T00:00:00.000Z', includesConversations: false },
      data,
    );
    const result = parseBackupBundle(serializeBackupBundle(bundle));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.curriculumVersion).toBeNull();
  });
});

describe('parseBackupBundle — files from before 021', () => {
  it('reads a file with no grammar answer tables as empty tables', () => {
    const data = Object.fromEntries(BACKUP_DATA_KEYS.map((key) => [key, []])) as unknown as BackupData;
    const json = JSON.parse(
      serializeBackupBundle(
        buildBackupBundle(
          { schemaVersion: 20, curriculumVersion: '31', exportedAt: '2026-10-01T00:00:00.000Z', includesConversations: false },
          data,
        ),
      ),
    );
    delete json.data.grammarAnswers;
    delete json.data.grammarSentenceHistory;

    const parsed = parseBackupBundle(JSON.stringify(json));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.data.grammarAnswers).toEqual([]);
    expect(parsed.value.data.grammarSentenceHistory).toEqual([]);
  });
});
