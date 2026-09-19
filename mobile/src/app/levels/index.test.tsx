import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import React from 'react';

import { openDatabaseAsync, __mockResetSqlite, __mockSetItems } from '../../../__mocks__/expo-sqlite';

import { getStartingJlptLevel, setStartingJlptLevel } from '@/data/user/preferencesRepository';

import LevelsScreen from './index';

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}) as Record<string, string | string[]>);

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference out-of-scope imports
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

let mockCurriculumDb: SQLiteDatabase;
let mockUserDb: SQLiteDatabase;

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ curriculumDb: mockCurriculumDb, userDb: mockUserDb }),
}));

describe('LevelsScreen', () => {
  beforeEach(async () => {
    __mockResetSqlite();
    mockBack.mockClear();
    mockUseLocalSearchParams.mockReturnValue({});

    mockCurriculumDb = (await openDatabaseAsync('curriculum.db')) as unknown as SQLiteDatabase;
    mockUserDb = (await openDatabaseAsync('user.db')) as unknown as SQLiteDatabase;

    __mockSetItems('curriculum.db', [
      { id: 1, slug: 'k1', primary_form: '一', meaning: 'one', item_type: 'kanji', jlpt_level: 'N5', sort_order: 1 },
      { id: 2, slug: 'k2', primary_form: '三', meaning: 'three', item_type: 'kanji', jlpt_level: 'N4', sort_order: 1 },
      { id: 3, slug: 'g1', primary_form: 'です', meaning: 'to be', item_type: 'grammar', jlpt_level: 'N5', sort_order: 1 },
      { id: 4, slug: 'g2', primary_form: 'ます', meaning: 'polite', item_type: 'grammar', jlpt_level: 'N4', sort_order: 1 },
    ]);

    setStartingJlptLevel(mockUserDb, 'N4');
  });

  it('renders a card per JLPT level with the header and back button', async () => {
    render(<LevelsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('levels-card-N5')).toBeTruthy();
    });

    expect(screen.getByText('JLPT Levels')).toBeTruthy();
    expect(screen.getByTestId('levels-card-N4')).toBeTruthy();
    expect(screen.getByTestId('levels-card-N3')).toBeTruthy();
    expect(screen.getByTestId('levels-card-N2')).toBeTruthy();
    expect(screen.getByTestId('levels-card-N1')).toBeTruthy();

    fireEvent.press(screen.getByTestId('levels-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('switches the active level when "Set as active level" is pressed, without navigating away', async () => {
    render(<LevelsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('levels-card-N5-set-active')).toBeTruthy();
    });

    expect(getStartingJlptLevel(mockUserDb)).toBe('N4');

    fireEvent.press(screen.getByTestId('levels-card-N5-set-active'));

    await waitFor(() => {
      expect(getStartingJlptLevel(mockUserDb)).toBe('N5');
    });

    expect(screen.getByTestId('levels-card-N4-set-active')).toBeTruthy();
    expect(screen.queryByTestId('levels-card-N5-set-active')).toBeNull();
  });
});
