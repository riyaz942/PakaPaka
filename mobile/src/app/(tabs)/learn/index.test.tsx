import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite, __mockSetItems } from '../../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { setStartingJlptLevel } from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import LearnScreen from './index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

function renderLearnScreen(
  curriculumDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
  userDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
) {
  const contextValue: DatabaseContextValue = {
    curriculumDb,
    userDb,
    isReady: true,
    error: null,
  };

  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <DatabaseContext.Provider value={contextValue}>
        <LearnScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('LearnScreen', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockPush.mockClear();
  });

  async function createDatabases(startingLevel: 'N5' | 'N3' = 'N5') {
    const userDb = await openDatabaseAsync('user.db');
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');

    const migrationResult = runMigrations(userDb, [migration001Initial]);
    expect(migrationResult.ok).toBe(true);

    setStartingJlptLevel(userDb, startingLevel);

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 2,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'book',
        primary_form: '本',
        meaning: 'book',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
      {
        id: 3,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'watashi',
        primary_form: '私',
        meaning: 'I, me',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 4,
        item_type: 'grammar',
        jlpt_level: 'N5',
        slug: 'desu',
        primary_form: 'です',
        meaning: 'to be (polite)',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    return { userDb, curriculumDb };
  }

  it('renders type counts for the default N5 level', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLearnScreen(curriculumDb, userDb);

    expect(screen.getByText('Learn')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByLabelText('Kanji, 2 items')).toBeTruthy();
      expect(screen.getByLabelText('Vocabulary, 1 items')).toBeTruthy();
      expect(screen.getByLabelText('Grammar, 1 items')).toBeTruthy();
    });
  });

  it('defaults to starting JLPT level from preferences', async () => {
    const { userDb, curriculumDb } = await createDatabases('N3');
    renderLearnScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('jlpt-level-N3').props.accessibilityState).toEqual({
        selected: true,
        checked: true,
      });
    });
  });

  it('updates counts when the level picker changes', async () => {
    const { userDb, curriculumDb } = await createDatabases();

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 10,
        item_type: 'kanji',
        jlpt_level: 'N4',
        slug: 'school',
        primary_form: '校',
        meaning: 'school',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    renderLearnScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByLabelText('Kanji, 1 items')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('jlpt-level-N4'));

    await waitFor(() => {
      expect(screen.getByLabelText('Kanji, 1 items')).toBeTruthy();
      expect(screen.getByLabelText('Vocabulary, 0 items')).toBeTruthy();
    });
  });

  it('navigates to the level screen when a type card is pressed', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderLearnScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('learn-type-card-kanji')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('learn-type-card-kanji'));

    expect(mockPush).toHaveBeenCalledWith('/learn/N5?type=kanji');
  });
});
