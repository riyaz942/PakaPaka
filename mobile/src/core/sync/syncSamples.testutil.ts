import type { BackupData } from '@/core/backup/backup.types';

const ITEM = { itemType: 'vocabulary', slug: 'neko' } as const;
const AT = '2026-11-01T00:00:00.000Z';

/** One valid row in every sync table; the two conversation tables stay empty. */
export function fullSampleData(): BackupData {
  return {
    userPreferences: [{ key: 'session_intensity', value: 'standard', updatedAt: AT }],
    itemStudyStatus: [{ item: ITEM, status: 'known', updatedAt: AT }],
    srsStates: [
      {
        item: ITEM,
        stability: 2.5,
        difficulty: 5,
        dueDate: AT,
        fsrsState: 'review',
        reps: 3,
        lapses: 0,
        learningSteps: 0,
        isBurned: false,
        srsStageLabel: 'Apprentice 2',
        lastReviewedAt: null,
        updatedAt: AT,
      },
    ],
    importMetadata: [{ source: 'anki', importedAt: AT, mappedCount: 4, unmatchedCount: 1 }],
    personalMnemonics: [{ item: ITEM, mnemonicText: 'cat', updatedAt: AT }],
    relatedItemBoosts: [{ item: ITEM, boost: 0.5, updatedAt: AT }],
    weaknessStats: [
      {
        item: ITEM,
        correctCount: 1,
        incorrectCount: 2,
        typoCount: 0,
        lastErrorAt: null,
        lastErrorType: null,
        patternTags: null,
        updatedAt: AT,
      },
    ],
    cognitiveLoadHistory: [{ date: '2026-11-01', load: 12, threshold: 40, updatedAt: AT }],
    streaks: [
      {
        currentStreak: 2,
        longestStreak: 5,
        lastReviewDate: '2026-11-01',
        lastCelebratedDate: null,
        updatedAt: AT,
      },
    ],
    userSynonyms: [{ item: ITEM, answerType: 'meaning', answerText: 'cat', createdAt: AT }],
    dailyLessonLog: [{ date: '2026-11-01', itemsStarted: 3 }],
    goalRingState: [
      {
        dailyGoalTarget: null,
        goalWeekStart: null,
        consecutiveMissWeeks: 0,
        pendingRiseTo: null,
        pendingReductionTo: null,
        updatedAt: AT,
      },
    ],
    furiganaOverrides: [{ item: ITEM, displayMode: 'shown', updatedAt: AT }],
    cardSeen: [{ cardId: 'welcome', seenAt: AT }],
    passagePracticeResults: [
      { passageId: '7', questionId: '21', isCorrect: true, userAnswer: 'a', answeredAt: AT },
    ],
    grammarAnswers: [{ item: ITEM, sentenceKey: '猫がいる', answerText: '猫がいます', createdAt: AT }],
    grammarSentenceHistory: [{ item: ITEM, sentenceKeys: ['a', 'b'], updatedAt: AT }],
    lessonOptIns: [{ item: ITEM, optedInAt: AT }],
    aiSessions: [],
    aiMessages: [],
  };
}
