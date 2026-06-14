import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite, __mockSetItems } from '../../../../../__mocks__/expo-sqlite';

import { DatabaseContext } from '@/providers/DatabaseContext';

import LearnItemDetailScreen from './[id]';

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

function renderDetailScreen(
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
        <LearnItemDetailScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('LearnItemDetailScreen', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockBack.mockClear();
    mockUseLocalSearchParams.mockReturnValue({ id: '1' });
  });

  async function createCurriculumDb() {
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');
    const userDb = await openDatabaseAsync('user.db');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'one',
        primary_form: '一',
        meaning: 'one',
        mnemonic_text: 'Radical one (一)',
        visual_mnemonic_url: 'https://example.com/one.png',
        sort_order: 1,
      },
      {
        id: 2,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    return { curriculumDb, userDb };
  }

  it('renders radical detail with glyph, meaning, and mnemonic image', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('radical-detail')).toBeTruthy();
      expect(screen.getByText('一')).toBeTruthy();
      expect(screen.getByText('one')).toBeTruthy();
      expect(screen.getByText('Radical one (一)')).toBeTruthy();
      expect(screen.getByTestId('radical-mnemonic-image')).toBeTruthy();
    });
  });

  it('navigates back when Back is pressed', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('learn-item-back')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('learn-item-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows not found state for unknown id', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    mockUseLocalSearchParams.mockReturnValue({ id: '999' });
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('Item not found.')).toBeTruthy();
    });
  });

  it('shows placeholder for non-radical item types', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    mockUseLocalSearchParams.mockReturnValue({ id: '2' });
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('Detail for Kanji coming soon')).toBeTruthy();
    });
  });

  it('shows mnemonic text once when visual mnemonic URL is missing', async () => {
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');
    const userDb = await openDatabaseAsync('user.db');

    __mockSetItems('curriculum.db.test', [
      {
        id: 3,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'two',
        primary_form: '二',
        meaning: 'two',
        mnemonic_text: 'Radical two (二)',
        visual_mnemonic_url: null,
        sort_order: 2,
      },
    ]);

    mockUseLocalSearchParams.mockReturnValue({ id: '3' });
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getAllByText('Radical two (二)')).toHaveLength(1);
    });
  });

  it('shows mnemonic text once when the image fails to load', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('mock-expo-image')).toBeTruthy();
      expect(screen.getByText('Radical one (一)')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('mock-expo-image-trigger-error'));

    await waitFor(() => {
      expect(screen.getAllByText('Radical one (一)')).toHaveLength(1);
    });
  });
});
