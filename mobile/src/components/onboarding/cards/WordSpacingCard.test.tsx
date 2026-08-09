import { render, screen, within } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import {
  __mockResetSqlite,
  __mockSetExampleSentences,
  __mockSetExampleSentenceVocab,
  __mockSetItems,
} from '../../../../__mocks__/expo-sqlite';

import { WordSpacingCard } from '@/components/onboarding/cards/WordSpacingCard';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

function seedWaTopic() {
  __mockSetItems('curriculum.db', [
    {
      id: 968,
      item_type: 'grammar',
      jlpt_level: 'N5',
      slug: 'wa-topic',
      primary_form: 'は',
      furigana: null,
      meaning: 'topic marker',
      mnemonic_text: null,
      visual_mnemonic_url: null,
      sort_order: 1,
    },
    {
      id: 100,
      item_type: 'vocabulary',
      jlpt_level: 'N5',
      slug: 'watashi',
      primary_form: '私',
      furigana: '私[わたし]',
      meaning: 'I',
      mnemonic_text: null,
      visual_mnemonic_url: null,
      sort_order: 2,
    },
    {
      id: 101,
      item_type: 'vocabulary',
      jlpt_level: 'N5',
      slug: 'gakusei',
      primary_form: '学生',
      furigana: '学[がく]生[せい]',
      meaning: 'student',
      mnemonic_text: null,
      visual_mnemonic_url: null,
      sort_order: 3,
    },
  ]);

  __mockSetExampleSentences('curriculum.db', [
    {
      id: 2713,
      item_id: 968,
      japanese: '私は学生です。',
      furigana: '私[わたし]は学[がく]生[せい]です。',
      english: 'I am a student.',
      sort_order: 0,
    },
  ]);

  __mockSetExampleSentenceVocab('curriculum.db', [
    { sentence_id: 2713, item_id: 100, sort_order: 0 },
    { sentence_id: 2713, item_id: 101, sort_order: 1 },
  ]);
}

async function renderCard() {
  const db = await openDatabaseAsync('curriculum.db');
  const contextValue: DatabaseContextValue = {
    curriculumDb: db,
    userDb: db,
    isReady: true,
    error: null,
  };

  return render(
    <DatabaseContext.Provider value={contextValue}>
      <WordSpacingCard />
    </DatabaseContext.Provider>,
  );
}

describe('WordSpacingCard', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('shows the authored sentence verbatim, with no spaces inserted', async () => {
    seedWaTopic();
    await renderCard();

    // FuriganaText labels its container with the plain surface form, so this
    // asserts the whole unbroken sentence, readings and all.
    expect(within(screen.getByTestId('word-spacing-verbatim')).getByLabelText('私は学生です。'))
      .toBeTruthy();
    expect(screen.getByText('I am a student.')).toBeTruthy();
  });

  it('pulls the same sentence apart on its authored word boundaries', async () => {
    seedWaTopic();
    await renderCard();

    const separated = within(screen.getByTestId('word-spacing-separated'));
    expect(separated.getAllByTestId(/^word-spacing-part-/)).toHaveLength(4);

    // 私 / は / 学生 / です。 — the particle は comes back as its own part,
    // which is the teaching point.
    expect(separated.getByLabelText('私')).toBeTruthy();
    expect(separated.getByText('は')).toBeTruthy();
    expect(separated.getByLabelText('学生')).toBeTruthy();
    expect(separated.getByText('です。')).toBeTruthy();
  });

  it('renders nothing when the grammar point has no sentence, without substituting one', async () => {
    __mockSetItems('curriculum.db', []);
    await renderCard();

    expect(screen.queryByTestId('word-spacing-verbatim')).toBeNull();
    expect(screen.queryByTestId('word-spacing-separated')).toBeNull();
  });
});
