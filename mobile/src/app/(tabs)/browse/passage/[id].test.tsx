import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  __mockResetSqlite,
  __mockSetItems,
  __mockSetPassageGrammarLinks,
  __mockSetPassagePracticeResults,
  __mockSetPassageQuestions,
  __mockSetPassageVocabularyLinks,
  __mockSetPassageWordSpans,
  __mockSetReadingPassages,
  __mockSetSrsStates,
} from '../../../../../__mocks__/expo-sqlite';

import { migration004PassagePracticeResults } from '@/data/migrations/004_passage_practice_results';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { DatabaseContext } from '@/providers/DatabaseContext';

import BrowsePassageRoute from './[id]';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    push: (href: string) => mockPush(href),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

function renderPassageScreen(
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
        <BrowsePassageRoute />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

const REVIEWED_ISO = '2026-06-25T10:00:00.000Z';

/** A settled SRS row at the given stage — only the stage matters for unlock. */
function srsRow(itemId: number, srsStageLabel: string) {
  return {
    item_id: itemId,
    stability: 5,
    difficulty: 5,
    due_date: REVIEWED_ISO,
    fsrs_state: 'review',
    reps: 4,
    lapses: 0,
    is_burned: 0,
    srs_stage_label: srsStageLabel,
    updated_at: REVIEWED_ISO,
  };
}

describe('BrowsePassageRoute', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockBack.mockClear();
    mockPush.mockClear();
    mockUseLocalSearchParams.mockReturnValue({ id: '1' });
  });

  async function createDatabases() {
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');
    const userDb = await openDatabaseAsync('user.db');

    const migrationResult = runMigrations(userDb, [migration004PassagePracticeResults]);
    expect(migrationResult.ok).toBe(true);

    __mockSetReadingPassages('curriculum.db.test', [
      {
        id: 1,
        jlpt_level: 'N5',
        title: '自己紹介',
        body: '私は学生です。',
        sort_order: 1,
      },
    ]);

    __mockSetPassageQuestions('curriculum.db.test', [
      {
        id: 1,
        passage_id: 1,
        prompt: 'この人は何ですか？',
        accepted_answers: '["学生","がくせい"]',
        sort_order: 1,
      },
    ]);

    return { curriculumDb, userDb };
  }

  it('renders passage title, body, and question prompt', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('passage-reader')).toBeTruthy();
      expect(screen.getByText('自己紹介')).toBeTruthy();
      expect(screen.getByText('私は学生です。')).toBeTruthy();
      expect(screen.getByText('この人は何ですか？')).toBeTruthy();
    });
  });

  it('shows correct feedback after submitting a correct answer', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('passage-question-input-1')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('passage-question-input-1'), '学生');
    fireEvent.press(screen.getByTestId('passage-question-submit-1'));

    await waitFor(() => {
      expect(screen.getByTestId('passage-question-feedback-1')).toBeTruthy();
      expect(screen.getByText('Correct')).toBeTruthy();
      expect(screen.getByText('Accepted answer: 学生 / がくせい')).toBeTruthy();
    });
  });

  it('shows incorrect feedback after submitting a wrong answer', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('passage-question-input-1')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('passage-question-input-1'), '先生');
    fireEvent.press(screen.getByTestId('passage-question-submit-1'));

    await waitFor(() => {
      expect(screen.getByText('Incorrect')).toBeTruthy();
      expect(screen.getByText('Accepted answer: 学生 / がくせい')).toBeTruthy();
    });
  });

  it('restores persisted answer state on remount', async () => {
    const { curriculumDb, userDb } = await createDatabases();

    __mockSetPassagePracticeResults('user.db', [
      {
        passage_id: 1,
        question_id: 1,
        is_correct: 0,
        user_answer: '先生',
        answered_at: '2026-06-25T10:00:00.000Z',
      },
    ]);

    const firstRender = renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('Incorrect')).toBeTruthy();
      expect(screen.getByDisplayValue('先生')).toBeTruthy();
    });

    firstRender.unmount();
    renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('Incorrect')).toBeTruthy();
      expect(screen.getByDisplayValue('先生')).toBeTruthy();
    });
  });

  it('navigates back when Back is pressed', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('read-passage-back')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('read-passage-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows not found state for unknown id', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    mockUseLocalSearchParams.mockReturnValue({ id: '999' });
    renderPassageScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByText('Passage not found.')).toBeTruthy();
    });
  });

  describe('unlock gating (FR68 / FR69)', () => {
    /** Links the passage to two items, neither of which is Guru+ (so: locked). */
    function seedLockedPassage() {
      __mockSetItems('curriculum.db.test', [
        {
          id: 10,
          slug: 'gakusei',
          item_type: 'vocabulary',
          jlpt_level: 'N5',
          primary_form: '学生',
          meaning: 'student',
          sort_order: 1,
        },
        {
          id: 30,
          slug: 'desu',
          item_type: 'grammar',
          jlpt_level: 'N5',
          primary_form: 'です',
          meaning: 'to be (polite)',
          sort_order: 2,
        },
      ]);
      __mockSetPassageVocabularyLinks('curriculum.db.test', [
        { passage_id: 1, vocabulary_item_id: 10 },
      ]);
      __mockSetPassageGrammarLinks('curriculum.db.test', [
        { passage_id: 1, grammar_item_id: 30 },
      ]);
    }

    it('shows the needed-items to-do instead of the reader when locked', async () => {
      const { curriculumDb, userDb } = await createDatabases();
      seedLockedPassage();
      renderPassageScreen(curriculumDb, userDb);

      await waitFor(() => {
        expect(screen.getByTestId('passage-locked-todo')).toBeTruthy();
      });

      // The learner sees what is missing, never a dead-end padlock.
      expect(screen.getByText('学生')).toBeTruthy();
      expect(screen.getByText('です')).toBeTruthy();
      expect(screen.getByTestId('passage-locked-remaining')).toBeTruthy();

      // No reader and no comprehension practice while locked.
      expect(screen.queryByTestId('passage-reader')).toBeNull();
      expect(screen.queryByTestId('passage-question-input-1')).toBeNull();
    });

    it('navigates to the item detail from a needed-item row', async () => {
      const { curriculumDb, userDb } = await createDatabases();
      seedLockedPassage();
      renderPassageScreen(curriculumDb, userDb);

      await waitFor(() => {
        expect(screen.getByTestId('passage-needed-item-10')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('passage-needed-item-10'));

      expect(mockPush).toHaveBeenCalledWith('/browse/item/10');
    });

    it('opens the reader once linked items reach Guru', async () => {
      const { curriculumDb, userDb } = await createDatabases();
      seedLockedPassage();
      __mockSetSrsStates('user.db', [
        srsRow(10, 'guru'),
        srsRow(30, 'master'),
      ]);
      renderPassageScreen(curriculumDb, userDb);

      await waitFor(() => {
        expect(screen.getByTestId('passage-reader')).toBeTruthy();
      });
      expect(screen.queryByTestId('passage-locked-todo')).toBeNull();
    });
  });

  describe('word spans (FR70 / NFR29)', () => {
    async function renderWithSpans() {
      const { curriculumDb, userDb } = await createDatabases();
      __mockSetItems('curriculum.db.test', [
        {
          id: 10,
          slug: 'gakusei',
          item_type: 'vocabulary',
          jlpt_level: 'N5',
          primary_form: '学生',
          meaning: 'student',
          furigana: '学生[がくせい]',
          sort_order: 1,
        },
      ]);
      // Body is 私は学生です。— 学生 sits at offsets [2, 4).
      __mockSetPassageWordSpans('curriculum.db.test', [
        {
          id: 1,
          passage_id: 1,
          vocabulary_item_id: 10,
          start_offset: 2,
          end_offset: 4,
          sort_order: 0,
        },
      ]);
      renderPassageScreen(curriculumDb, userDb);

      await waitFor(() => {
        expect(screen.getByTestId('passage-word-10')).toBeTruthy();
      });
    }

    it('opens the detail sheet on a plain tap — the visible non-gesture path', async () => {
      await renderWithSpans();

      fireEvent.press(screen.getByTestId('passage-word-10'));

      await waitFor(() => {
        expect(screen.getByText('student')).toBeTruthy();
      });
    });

    it('opens the same detail sheet on long press', async () => {
      await renderWithSpans();

      fireEvent(screen.getByTestId('passage-word-10'), 'longPress');

      await waitFor(() => {
        expect(screen.getByText('student')).toBeTruthy();
      });
    });

    it('labels the span as a button naming the word and the action', async () => {
      await renderWithSpans();

      const span = screen.getByTestId('passage-word-10');
      expect(span.props.accessibilityRole).toBe('button');
      expect(span.props.accessibilityLabel).toBe('学生, show word details');
    });

    it('leaves text without an authored span inert', async () => {
      await renderWithSpans();

      // 私 has no span, so there is no pressable for it.
      expect(screen.queryByTestId('passage-word-11')).toBeNull();
    });
  });

  describe('practice read-back (BUG5)', () => {
    it('disables the input for an already-correct answer on reopen', async () => {
      const { curriculumDb, userDb } = await createDatabases();
      __mockSetPassagePracticeResults('user.db', [
        {
          passage_id: 1,
          question_id: 1,
          is_correct: 1,
          user_answer: '学生',
          answered_at: '2026-06-25T10:00:00.000Z',
        },
      ]);

      renderPassageScreen(curriculumDb, userDb);

      await waitFor(() => {
        expect(screen.getByText('Correct')).toBeTruthy();
      });

      expect(screen.getByTestId('passage-question-input-1').props.editable).toBe(false);
      // A settled question offers no resubmit.
      expect(screen.queryByTestId('passage-question-submit-1')).toBeNull();
    });

    it('keeps an incorrect answer editable so it can be retried', async () => {
      const { curriculumDb, userDb } = await createDatabases();
      __mockSetPassagePracticeResults('user.db', [
        {
          passage_id: 1,
          question_id: 1,
          is_correct: 0,
          user_answer: '先生',
          answered_at: '2026-06-25T10:00:00.000Z',
        },
      ]);

      renderPassageScreen(curriculumDb, userDb);

      await waitFor(() => {
        expect(screen.getByText('Incorrect')).toBeTruthy();
      });

      expect(screen.getByTestId('passage-question-input-1').props.editable).toBe(true);
      expect(screen.getByTestId('passage-question-submit-1')).toBeTruthy();

      // Retrying with the right answer settles the question.
      fireEvent.changeText(screen.getByTestId('passage-question-input-1'), '学生');
      fireEvent.press(screen.getByTestId('passage-question-submit-1'));

      await waitFor(() => {
        expect(screen.getByText('Correct')).toBeTruthy();
      });
      expect(screen.getByTestId('passage-question-input-1').props.editable).toBe(false);
    });
  });
});
