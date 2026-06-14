import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite, __mockSetItems } from '../../../../__mocks__/expo-sqlite';

import { DatabaseContext } from '@/providers/DatabaseContext';

import LearnLevelScreen from './[level]';

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

function renderLearnLevelScreen(
  curriculumDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
  userDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
) {
  const contextValue = {
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
        <LearnLevelScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('LearnLevelScreen', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockBack.mockClear();
    mockUseLocalSearchParams.mockReturnValue({ level: 'N5', type: 'kanji' });
  });

  async function createCurriculumDb() {
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');
    const userDb = await openDatabaseAsync('user.db');

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
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'watashi',
        primary_form: '私',
        meaning: 'I, me',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    return { curriculumDb, userDb };
  }

  it('renders kanji items for the selected level', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    renderLearnLevelScreen(curriculumDb, userDb);

    expect(screen.getByText('N5')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId('learn-item-1')).toBeTruthy();
      expect(screen.getByText('日')).toBeTruthy();
    });
  });

  it('switches list content when the type tab changes', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    renderLearnLevelScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('learn-item-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('learn-type-picker-vocabulary'));

    await waitFor(() => {
      expect(screen.getByText('私')).toBeTruthy();
      expect(screen.queryByTestId('learn-item-1')).toBeNull();
    });
  });

  it('syncs the type tab when the URL type param changes', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    const view = renderLearnLevelScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('learn-item-1')).toBeTruthy();
    });

    mockUseLocalSearchParams.mockReturnValue({ level: 'N5', type: 'vocabulary' });
    view.rerender(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}>
        <DatabaseContext.Provider
          value={{ curriculumDb, userDb, isReady: true, error: null }}>
          <LearnLevelScreen />
        </DatabaseContext.Provider>
      </SafeAreaProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('私')).toBeTruthy();
      expect(screen.queryByTestId('learn-item-1')).toBeNull();
    });
  });

  it('navigates back to the hub when Back is pressed', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    renderLearnLevelScreen(curriculumDb, userDb);

    fireEvent.press(screen.getByTestId('learn-level-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no items exist for level and type', async () => {
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');
    const userDb = await openDatabaseAsync('user.db');
    __mockSetItems('curriculum.db.test', []);

    renderLearnLevelScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('No Kanji at N5 yet.')).toBeTruthy();
    });
  });
});
