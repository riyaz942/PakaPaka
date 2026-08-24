import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite, __mockSetAcceptedAnswers, __mockSetExampleSentences, __mockSetGrammarRules, __mockSetGrammarVocabLinks, __mockSetItems, __mockSetKanjiReadings, __mockSetPersonalMnemonics } from '../../../../../__mocks__/expo-sqlite';

import { DatabaseContext } from '@/providers/DatabaseContext';

import BrowseItemDetailRoute from './[id]';

// Radical art is bundled, so the real map only contains committed files. These
// tests exercise layout, not asset resolution: treat any ref as drawn.
jest.mock('@/utils/radicalImages', () => ({
  getRadicalImage: (ref?: string | null) => (ref ? 1 : undefined),
}));

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      const cleanup = callback();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [callback]);
  },
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
        <BrowseItemDetailRoute />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('BrowseItemDetailRoute', () => {
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
        visual_mnemonic_url: 'radicals/n5/ichi.webp',
        sort_order: 1,
      },
      {
        id: 2,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day',
        mnemonic_text: 'The sun rises each day.',
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 3,
        item_type: 'vocabulary',
        jlpt_level: 'N5',
        slug: 'watashi',
        primary_form: '私',
        meaning: 'I, me',
        mnemonic_text: 'Think of private self.',
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
        mnemonic_text: 'Desu sounds polite.',
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    __mockSetKanjiReadings('curriculum.db.test', [
      {
        id: 1,
        item_id: 2,
        reading_type: 'onyomi',
        reading: 'ニチ',
        sort_order: 1,
      },
      {
        id: 2,
        item_id: 2,
        reading_type: 'kunyomi',
        reading: 'ひ',
        sort_order: 2,
      },
    ]);

    __mockSetAcceptedAnswers('curriculum.db.test', [
      {
        id: 1,
        item_id: 2,
        answer_type: 'meaning',
        answer_text: 'day',
        is_primary: 1,
      },
      {
        id: 2,
        item_id: 2,
        answer_type: 'meaning',
        answer_text: 'sun',
        is_primary: 0,
      },
    ]);

    __mockSetExampleSentences('curriculum.db.test', [
      {
        id: 1,
        item_id: 3,
        japanese: '私は学生です。',
        english: 'I am a student.',
        sort_order: 1,
      },
      {
        id: 1,
        item_id: 4,
        japanese: 'これは本です。',
        english: 'This is a book.',
        sort_order: 1,
      },
    ]);

    __mockSetGrammarRules('curriculum.db.test', [
      {
        id: 1,
        item_id: 4,
        structure: 'Noun + です',
        conjugation_rules: '{"polite": true}',
        accepted_forms: '["です", "だ"]',
      },
    ]);

    __mockSetGrammarVocabLinks('curriculum.db.test', [
      {
        id: 1,
        grammar_item_id: 4,
        vocabulary_item_id: 3,
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

  it('renders kanji detail with readings and synonyms', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    mockUseLocalSearchParams.mockReturnValue({ id: '2' });
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('kanji-detail')).toBeTruthy();
      expect(screen.getByText('日')).toBeTruthy();
      expect(screen.getByText("On'yomi")).toBeTruthy();
      expect(screen.getByText('ニチ')).toBeTruthy();
      expect(screen.getByText("Kun'yomi")).toBeTruthy();
      expect(screen.getByText('ひ')).toBeTruthy();
    });

    // Curriculum accepted answers sit behind a disclosure (FR77).
    expect(screen.queryByText('sun')).toBeNull();
    fireEvent.press(screen.getByTestId('accepted-answers-disclosure-toggle'));
    expect(screen.getByText('sun')).toBeTruthy();
  });

  it('shows a passive study-status banner without gating content', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    mockUseLocalSearchParams.mockReturnValue({ id: '2' });
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('study-status-banner')).toBeTruthy();
    });

    expect(screen.getByText("You haven't studied this yet.")).toBeTruthy();
    // Content stays fully visible, and details is never a lesson entry point.
    expect(screen.getByText('日')).toBeTruthy();
    expect(screen.queryByText(/Start lesson/i)).toBeNull();
  });

  it('renders vocabulary detail with examples and grammar links', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    mockUseLocalSearchParams.mockReturnValue({ id: '3' });
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('vocabulary-detail')).toBeTruthy();
      // The hero and the always-visible reading section both show 私 — this
      // fixture has no furigana, so the reading section falls back to it.
      expect(screen.getAllByText('私').length).toBeGreaterThan(0);
      expect(screen.getByText('私は学生です。')).toBeTruthy();
      expect(screen.getByTestId('cross-ref-grammar-4')).toBeTruthy();
    });
  });

  it('renders grammar detail with structure and forms', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    mockUseLocalSearchParams.mockReturnValue({ id: '4' });
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('grammar-detail')).toBeTruthy();
      // Hero pattern plus the accepted-form chip — both read です.
      expect(screen.getAllByText('です')).toHaveLength(2);
      expect(screen.getByText('Noun + です')).toBeTruthy();
      expect(screen.getByText('これは本です。')).toBeTruthy();
      expect(screen.getByText('This is a book.')).toBeTruthy();
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

  it('renders personal mnemonic editor for kanji, vocabulary, and grammar', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();

    mockUseLocalSearchParams.mockReturnValue({ id: '2' });
    const kanjiRender = renderDetailScreen(curriculumDb, userDb);
    await waitFor(() => {
      expect(screen.getByTestId('personal-mnemonic-editor')).toBeTruthy();
    });
    kanjiRender.unmount();

    mockUseLocalSearchParams.mockReturnValue({ id: '3' });
    const vocabRender = renderDetailScreen(curriculumDb, userDb);
    await waitFor(() => {
      expect(screen.getByTestId('personal-mnemonic-editor')).toBeTruthy();
    });
    vocabRender.unmount();

    mockUseLocalSearchParams.mockReturnValue({ id: '4' });
    renderDetailScreen(curriculumDb, userDb);
    await waitFor(() => {
      expect(screen.getByTestId('personal-mnemonic-editor')).toBeTruthy();
    });
  });

  it('does not render personal mnemonic editor for radicals', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    mockUseLocalSearchParams.mockReturnValue({ id: '1' });
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('radical-detail')).toBeTruthy();
    });

    expect(screen.queryByTestId('personal-mnemonic-editor')).toBeNull();
  });

  it('persists personal mnemonic text after save on kanji detail', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    mockUseLocalSearchParams.mockReturnValue({ id: '2' });
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('personal-mnemonic-empty')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('personal-mnemonic-empty'));
    fireEvent.changeText(screen.getByTestId('personal-mnemonic-input'), 'My day mnemonic');
    fireEvent.press(screen.getByTestId('personal-mnemonic-save'));

    await waitFor(() => {
      expect(screen.getByTestId('personal-mnemonic-text')).toBeTruthy();
    });
    expect(screen.getByText('My day mnemonic')).toBeTruthy();
  });

  it('clears personal override while curriculum mnemonic remains', async () => {
    const { curriculumDb, userDb } = await createCurriculumDb();
    __mockSetPersonalMnemonics('user.db', [
      {
        item_id: 2,
        mnemonic_text: 'Override mnemonic',
        updated_at: '2026-06-27T10:00:00.000Z',
      },
    ]);

    mockUseLocalSearchParams.mockReturnValue({ id: '2' });
    renderDetailScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('Override mnemonic')).toBeTruthy();
      expect(screen.getByText('The sun rises each day.')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('personal-mnemonic-delete'));
    fireEvent.press(screen.getByTestId('personal-mnemonic-delete-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('personal-mnemonic-empty')).toBeTruthy();
    });
    // Deleting the personal override leaves the curriculum mnemonic intact.
    expect(screen.getByText('The sun rises each day.')).toBeTruthy();
  });
});
