import { renderHook } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import {
  __mockResetSqlite,
  __mockSetAcceptedAnswers,
  __mockSetItems,
  __mockSetKanjiReadings,
} from '../../../__mocks__/expo-sqlite';

import type { ReviewItem } from '@/core/srs/srs.types';
import { useAnswerCollision } from '@/data/hooks/useAnswerCollision';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    itemId: '1',
    itemType: 'kanji',
    primaryForm: '食',
    displayMeaning: 'eat, food',
    meanings: ['eat', 'food'],
    promptType: 'meaning',
    answerKey: {
      acceptedMeanings: ['eat', 'food'],
      acceptedReadings: ['ショク'],
    },
    relatedItems: [],
    reinforcementLink: null,
    srsState: {
      itemId: '1',
      stability: 1,
      difficulty: 5,
      dueDate: new Date().toISOString(),
      fsrsState: 'new',
      reps: 0,
      lapses: 0,
      learningSteps: 0,
      isBurned: false,
      srsStageLabel: 'apprentice',
      lastReviewedAt: null,
      updatedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe('useAnswerCollision (Story 1.2, FR86)', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function setup() {
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');
    const userDb = await openDatabaseAsync('user.db');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'eat',
        primary_form: '食',
        meaning: 'eat, food',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 2,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'drink',
        primary_form: '飲',
        meaning: 'drink',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
    ]);
    __mockSetAcceptedAnswers('curriculum.db.test', [
      { id: 1, item_id: 1, answer_type: 'meaning', answer_text: 'eat', is_primary: 1 },
      { id: 2, item_id: 2, answer_type: 'meaning', answer_text: 'Drink', is_primary: 1 },
    ]);
    __mockSetKanjiReadings('curriculum.db.test', [
      { id: 1, item_id: 2, reading_type: 'onyomi', reading: 'イン', sort_order: 0 },
    ]);

    const contextValue: DatabaseContextValue = {
      curriculumDb,
      userDb,
      isReady: true,
      error: null,
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
    );

    return renderHook(() => useAnswerCollision(), { wrapper });
  }

  it('detects a meaning collision case-insensitively', async () => {
    const { result } = await setup();

    expect(result.current(makeItem(), 'drink')).toEqual({
      itemId: '2',
      primaryForm: '飲',
    });
  });

  it("detects an on'yomi collision typed in hiragana against katakana curriculum data", async () => {
    const { result } = await setup();

    const readingItem = makeItem({ promptType: 'reading' });
    expect(result.current(readingItem, 'いん')).toEqual({
      itemId: '2',
      primaryForm: '飲',
    });
  });

  it('returns null when the answer matches nothing', async () => {
    const { result } = await setup();

    expect(result.current(makeItem(), 'banana')).toBeNull();
  });

  it('returns null for the current item’s own accepted answer', async () => {
    const { result } = await setup();

    expect(result.current(makeItem(), 'eat')).toBeNull();
  });

  it('returns null for a blank submission', async () => {
    const { result } = await setup();

    expect(result.current(makeItem(), '   ')).toBeNull();
  });

  it('returns null for production prompts (not a meaning/reading lookup)', async () => {
    const { result } = await setup();

    expect(
      result.current(makeItem({ promptType: 'production', itemType: 'grammar' }), 'drink'),
    ).toBeNull();
  });

  it('picks the lowest itemId when multiple items collide', async () => {
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');
    const userDb = await openDatabaseAsync('user.db');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'eat',
        primary_form: '食',
        meaning: 'eat, food',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 2,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'drink',
        primary_form: '飲',
        meaning: 'drink',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
      {
        id: 10,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'drink-vocab',
        primary_form: '飲む',
        meaning: 'drink',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 3,
      },
    ]);
    __mockSetAcceptedAnswers('curriculum.db.test', [
      { id: 1, item_id: 1, answer_type: 'meaning', answer_text: 'eat', is_primary: 1 },
      { id: 2, item_id: 10, answer_type: 'meaning', answer_text: 'drink', is_primary: 1 },
      { id: 3, item_id: 2, answer_type: 'meaning', answer_text: 'drink', is_primary: 1 },
    ]);
    __mockSetKanjiReadings('curriculum.db.test', []);

    const contextValue: DatabaseContextValue = {
      curriculumDb,
      userDb,
      isReady: true,
      error: null,
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
    );
    const { result } = renderHook(() => useAnswerCollision(), { wrapper });

    expect(result.current(makeItem(), 'drink')).toEqual({
      itemId: '2',
      primaryForm: '飲',
    });
  });
});
