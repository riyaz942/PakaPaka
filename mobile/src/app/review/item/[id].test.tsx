import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  __mockResetSqlite,
  __mockSetAcceptedAnswers,
  __mockSetItemRelationships,
  __mockSetItems,
  __mockSetKanjiReadings,
} from '../../../../__mocks__/expo-sqlite';

import { DatabaseContext } from '@/providers/DatabaseContext';

import ReviewItemDetailScreen from './[id]';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    push: (...args: unknown[]) => mockPush(...args),
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
        <ReviewItemDetailScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('ReviewItemDetailScreen (Story 1.2, FR85 — details under review/)', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockBack.mockClear();
    mockPush.mockClear();
    mockUseLocalSearchParams.mockReturnValue({ id: '2' });
  });

  async function createDbs() {
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');
    const userDb = await openDatabaseAsync('user.db');

    __mockSetItems('curriculum.db.test', [
      {
        id: 2,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'eat',
        primary_form: '食',
        meaning: 'eat, food',
        mnemonic_text: 'A roof over a fire cooking food.',
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 3,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'taberu',
        primary_form: '食べる',
        meaning: 'to eat',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);
    __mockSetItemRelationships('curriculum.db.test', [
      { parent_item_id: 2, child_item_id: 3, relationship_type: 'requires' },
    ]);
    __mockSetKanjiReadings('curriculum.db.test', [
      { id: 1, item_id: 2, reading_type: 'onyomi', reading: 'しょく', sort_order: 0 },
    ]);
    __mockSetAcceptedAnswers('curriculum.db.test', [
      { id: 1, item_id: 2, answer_type: 'meaning', answer_text: 'eat', is_primary: 1 },
    ]);

    return { curriculumDb, userDb };
  }

  it('renders the full item detail (depth lives here, not inline in the reveal)', async () => {
    const { curriculumDb, userDb } = await createDbs();
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('食')).toBeTruthy();
    });
    expect(screen.getByText('A roof over a fire cooking food.')).toBeTruthy();
  });

  it('offers a Back affordance that returns to the review session', async () => {
    const { curriculumDb, userDb } = await createDbs();
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('review-item-back')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('review-item-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('keeps cross-reference chips inside the review stack', async () => {
    const { curriculumDb, userDb } = await createDbs();
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('cross-ref-related-3')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('cross-ref-related-3'));

    // Pushing /browse/item from here would unmount ReviewSessionProvider.
    expect(mockPush).toHaveBeenCalledWith('/review/item/3');
  });

  it('shows a not-found message for an unknown id', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: '999' });
    const { curriculumDb, userDb } = await createDbs();
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('Item not found.')).toBeTruthy();
    });
  });
});
