import { render, screen } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite, __mockSetItems } from '../../../../__mocks__/expo-sqlite';

import { ThreeScriptsCard } from '@/components/onboarding/cards/ThreeScriptsCard';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

function seedScriptItems() {
  __mockSetItems('curriculum.db', [
    {
      id: 372,
      item_type: 'vocabulary',
      jlpt_level: 'N5',
      slug: 'hiragana',
      primary_form: 'ひらがな',
      furigana: 'ひらがな',
      meaning: 'hiragana',
      mnemonic_text: null,
      visual_mnemonic_url: null,
      sort_order: 1,
    },
    {
      id: 228,
      item_type: 'vocabulary',
      jlpt_level: 'N5',
      slug: 'basu',
      primary_form: 'バス',
      furigana: 'バス',
      meaning: 'bus',
      mnemonic_text: null,
      visual_mnemonic_url: null,
      sort_order: 2,
    },
    {
      id: 628,
      item_type: 'vocabulary',
      jlpt_level: 'N5',
      slug: 'nihongo',
      primary_form: '日本語',
      furigana: '日本[にほん]語[ご]',
      meaning: 'Japanese',
      mnemonic_text: null,
      visual_mnemonic_url: null,
      sort_order: 3,
    },
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
      <ThreeScriptsCard />
    </DatabaseContext.Provider>,
  );
}

describe('ThreeScriptsCard', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('renders the three scripts using real curriculum glyphs', async () => {
    seedScriptItems();
    await renderCard();

    expect(screen.getByText('ひらがな')).toBeTruthy();
    expect(screen.getByText('バス')).toBeTruthy();
    // 日本語 arrives annotated, so it renders as segments with their readings.
    expect(screen.getByText('日本')).toBeTruthy();
    expect(screen.getByText('にほん')).toBeTruthy();
    expect(screen.getByText('語')).toBeTruthy();
    expect(screen.getByText('ご')).toBeTruthy();
  });

  it('takes the meanings from the database, not from literals in the card', async () => {
    seedScriptItems();
    await renderCard();

    expect(screen.getByTestId('three-scripts-meaning-basu')).toHaveTextContent('bus');
    expect(screen.getByTestId('three-scripts-meaning-hiragana')).toHaveTextContent('hiragana');
    expect(screen.getByTestId('three-scripts-meaning-nihongo')).toHaveTextContent('Japanese');
  });

  it('omits a row whose slug is missing rather than substituting another item', async () => {
    __mockSetItems('curriculum.db', []);
    await renderCard();

    expect(screen.queryByTestId('three-scripts-row-hiragana')).toBeNull();
    expect(screen.queryByTestId('three-scripts-row-basu')).toBeNull();
    expect(screen.queryByTestId('three-scripts-row-nihongo')).toBeNull();
  });
});
