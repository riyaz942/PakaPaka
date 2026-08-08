import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite, __mockSetItems } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import { setStartingJlptLevel } from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import PlacementScreen from './placement';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

function kanji(id: number, form: string, sortOrder: number, level = 'N4') {
  return {
    id,
    item_type: 'kanji',
    jlpt_level: level,
    slug: `slug-${id}`,
    primary_form: form,
    meaning: `meaning-${id}`,
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: sortOrder,
  };
}

function grammar(id: number, form: string, sortOrder: number, level = 'N4') {
  return {
    id,
    item_type: 'grammar',
    jlpt_level: level,
    slug: `slug-${id}`,
    primary_form: form,
    meaning: `meaning-${id}`,
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: sortOrder,
  };
}

function radical(id: number, form: string, sortOrder: number, level = 'N5') {
  return {
    id,
    item_type: 'radical',
    jlpt_level: level,
    slug: `slug-${id}`,
    primary_form: form,
    meaning: `meaning-${id}`,
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: sortOrder,
  };
}

function renderPlacementScreen(
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
        <PlacementScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

/** The range step defaults to the starting level; confirm it to reach the self-check. */
async function startCheck() {
  await waitFor(() => {
    expect(screen.getByTestId('placement-range')).toBeTruthy();
  });
  fireEvent.press(screen.getByTestId('onboarding-primary-action'));
}

describe('PlacementScreen', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  async function createDatabases() {
    const userDb = await openDatabaseAsync('user.db');
    const curriculumDb = await openDatabaseAsync('curriculum.db.test');

    const migrationResult = runMigrations(userDb, [
      migration001Initial,
      migration002ItemStudyStatus,
    ]);
    expect(migrationResult.ok).toBe(true);

    setStartingJlptLevel(userDb, 'N4');
    __mockSetItems('curriculum.db.test', [
      kanji(11, '会', 1),
      kanji(12, '同', 2),
      kanji(13, '事', 3),
      kanji(14, '自', 4),
      radical(1, '一', 1),
      radical(2, '口', 2),
    ]);

    return { userDb, curriculumDb };
  }

  it('walks the self-check and applies the placement on confirm', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderPlacementScreen(curriculumDb, userDb);

    await startCheck();

    await waitFor(() => {
      expect(screen.getByTestId('placement-screen')).toBeTruthy();
    });

    // 4 N4 kanji sampled → answer know, know, not yet, not yet.
    fireEvent.press(screen.getByTestId('placement-answer-known'));
    fireEvent.press(screen.getByTestId('placement-answer-known'));
    fireEvent.press(screen.getByTestId('placement-answer-unknown'));
    fireEvent.press(screen.getByTestId('placement-answer-unknown'));

    await waitFor(() => {
      expect(screen.getByTestId('placement-summary')).toBeTruthy();
    });

    // A wide range puts steppers past the fold; unreachable ones cannot be adjusted.
    expect(screen.getByTestId('placement-summary-scroll')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Sounds right' }));

    // Ratio 0.5 → first two kanji known; both N5 radicals marked known as prerequisites.
    const statuses = listStudyStatusesForItems(userDb, ['11', '12', '13', '14', '1', '2']);
    expect(statuses.get('11')).toBe('known');
    expect(statuses.get('12')).toBe('known');
    expect(statuses.get('13')).toBeUndefined();
    expect(statuses.get('14')).toBeUndefined();
    expect(statuses.get('1')).toBe('known');
    expect(statuses.get('2')).toBe('known');

    expect(mockPush).toHaveBeenCalledWith('/onboarding/complete');
  });

  it('skip check still unlocks lower levels without marking level items', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderPlacementScreen(curriculumDb, userDb);

    await startCheck();

    await waitFor(() => {
      expect(screen.getByTestId('placement-screen')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('onboarding-primary-action'));

    const statuses = listStudyStatusesForItems(userDb, ['11', '12', '1', '2']);
    expect(statuses.get('11')).toBeUndefined();
    expect(statuses.get('1')).toBe('known');
    expect(statuses.get('2')).toBe('known');

    expect(mockPush).toHaveBeenCalledWith('/onboarding/complete');
  });

  it('start from scratch on the summary marks nothing inside the range', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderPlacementScreen(curriculumDb, userDb);

    await startCheck();
    await waitFor(() => {
      expect(screen.getByTestId('placement-screen')).toBeTruthy();
    });

    for (let i = 0; i < 4; i++) {
      fireEvent.press(screen.getByTestId('placement-answer-known'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('placement-summary')).toBeTruthy();
    });

    fireEvent.press(screen.getByRole('button', { name: 'Start from scratch instead' }));

    const statuses = listStudyStatusesForItems(userDb, ['11', '12', '13', '14', '1', '2']);
    expect(statuses.get('11')).toBeUndefined();
    expect(statuses.get('14')).toBeUndefined();
    expect(statuses.get('1')).toBe('known');
    expect(statuses.get('2')).toBe('known');
  });

  it('defaults both range endpoints to the starting level', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderPlacementScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('placement-range')).toBeTruthy();
    });

    const from = within(screen.getByTestId('placement-range-from'));
    const to = within(screen.getByTestId('placement-range-to'));
    expect(from.getByTestId('jlpt-level-N4').props.accessibilityState.selected).toBe(true);
    expect(to.getByTestId('jlpt-level-N4').props.accessibilityState.selected).toBe(true);
  });

  it('disables "test up to" levels below "test from" rather than snapping back', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderPlacementScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('placement-range')).toBeTruthy();
    });

    const to = within(screen.getByTestId('placement-range-to'));
    // N5 sits below the N4 start — visibly unavailable, not a silent no-op.
    expect(to.getByTestId('jlpt-level-N5').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(to.getByTestId('jlpt-level-N5'));

    expect(to.getByTestId('jlpt-level-N4').props.accessibilityState.selected).toBe(true);
    expect(to.getByTestId('jlpt-level-N5').props.accessibilityState.selected).toBe(false);
  });

  it('disables levels with no curriculum content in both pickers', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderPlacementScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('placement-range')).toBeTruthy();
    });

    // Only N5 and N4 have items in the fixture. Tapping an empty level used to
    // leave nothing to test, apply a blanket placement, and end onboarding.
    const from = within(screen.getByTestId('placement-range-from'));
    expect(from.getByTestId('jlpt-level-N3').props.accessibilityState.disabled).toBe(true);
    expect(from.getByTestId('jlpt-level-N5').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(from.getByTestId('jlpt-level-N3'));

    expect(from.getByTestId('jlpt-level-N4').props.accessibilityState.selected).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId('placement-range')).toBeTruthy();
  });

  it('scores each item type independently inside one level', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    // One level, two types: 6 kanji all known, 6 grammar all unknown. A single
    // blended ratio would mark half of each — the bug AC #3 exists to fix.
    __mockSetItems('curriculum.db.test', [
      ...Array.from({ length: 6 }, (_, i) => kanji(100 + i, `k${i}`, i + 1)),
      ...Array.from({ length: 6 }, (_, i) => grammar(200 + i, `g${i}`, i + 1)),
    ]);
    renderPlacementScreen(curriculumDb, userDb);

    await startCheck();
    await waitFor(() => {
      expect(screen.getByTestId('placement-screen')).toBeTruthy();
    });

    // 12 cards per level, two types → 6 kanji then 6 grammar.
    for (let i = 0; i < 6; i++) {
      fireEvent.press(screen.getByTestId('placement-answer-known'));
    }
    for (let i = 0; i < 6; i++) {
      fireEvent.press(screen.getByTestId('placement-answer-unknown'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('placement-summary')).toBeTruthy();
    });

    // The divergence is shown, not just applied: one stepper per item type, at
    // the granularity the cutoffs are actually computed at.
    expect(screen.getByTestId('placement-known-count-N4-kanji-value')).toHaveTextContent('6');
    expect(screen.getByTestId('placement-known-count-N4-grammar-value')).toHaveTextContent(
      '0',
    );

    fireEvent.press(screen.getByRole('button', { name: 'Sounds right' }));

    const statuses = listStudyStatusesForItems(
      userDb,
      ['100', '101', '102', '103', '104', '105', '200', '201', '202', '203', '204', '205'],
    );
    // Every kanji known, no grammar at all.
    for (let i = 0; i < 6; i++) {
      expect(statuses.get(String(100 + i))).toBe('known');
      expect(statuses.get(String(200 + i))).toBeUndefined();
    }
  });

  it('adjusts one item type without touching another in the same level', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    // 6 kanji and 6 grammar, all claimed known → both cells start full.
    __mockSetItems('curriculum.db.test', [
      ...Array.from({ length: 6 }, (_, i) => kanji(100 + i, `k${i}`, i + 1)),
      ...Array.from({ length: 6 }, (_, i) => grammar(200 + i, `g${i}`, i + 1)),
    ]);
    renderPlacementScreen(curriculumDb, userDb);

    await startCheck();
    await waitFor(() => {
      expect(screen.getByTestId('placement-screen')).toBeTruthy();
    });

    for (let i = 0; i < 12; i++) {
      fireEvent.press(screen.getByTestId('placement-answer-known'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('placement-summary')).toBeTruthy();
    });

    // Explicit claims pin every id into knownIds, so both cells read 6 of 6.
    const decrement = screen.getByTestId('placement-known-count-N4-grammar-decrement');
    for (let i = 0; i < 20 && !decrement.props.accessibilityState.disabled; i++) {
      fireEvent.press(decrement);
    }

    expect(screen.getByTestId('placement-known-count-N4-grammar-value')).toHaveTextContent(
      '0',
    );
    // Untouched — a per-level stepper could not express this.
    expect(screen.getByTestId('placement-known-count-N4-kanji-value')).toHaveTextContent('6');

    fireEvent.press(screen.getByRole('button', { name: 'Sounds right' }));

    const statuses = listStudyStatusesForItems(
      userDb,
      ['100', '105', '200', '205'],
    );
    expect(statuses.get('100')).toBe('known');
    expect(statuses.get('105')).toBe('known');
    expect(statuses.get('200')).toBeUndefined();
    expect(statuses.get('205')).toBeUndefined();
  });

  it('lets the summary stepper reach zero even when the step does not divide evenly', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    // 60 kanji, 7 ruled out → 53 adjustable, so step = round(53 / 20) = 3. With
    // a fixed-step decrement that leaves both 0 and 53 permanently unreachable.
    __mockSetItems(
      'curriculum.db.test',
      Array.from({ length: 60 }, (_, i) => kanji(300 + i, `k${i}`, i + 1)),
    );
    renderPlacementScreen(curriculumDb, userDb);

    await startCheck();
    await waitFor(() => {
      expect(screen.getByTestId('placement-screen')).toBeTruthy();
    });

    for (let i = 0; i < 5; i++) {
      fireEvent.press(screen.getByTestId('placement-answer-known'));
    }
    for (let i = 0; i < 7; i++) {
      fireEvent.press(screen.getByTestId('placement-answer-unknown'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('placement-summary')).toBeTruthy();
    });

    const decrement = screen.getByTestId('placement-known-count-N4-kanji-decrement');
    for (let i = 0; i < 40 && !decrement.props.accessibilityState.disabled; i++) {
      fireEvent.press(decrement);
    }
    expect(screen.getByTestId('placement-known-count-N4-kanji-value')).toHaveTextContent('0');

    const increment = screen.getByTestId('placement-known-count-N4-kanji-increment');
    for (let i = 0; i < 40 && !increment.props.accessibilityState.disabled; i++) {
      fireEvent.press(increment);
    }
    // 60 items − 7 answered "not yet" = 53 reachable, and the ceiling is reached.
    expect(screen.getByTestId('placement-known-count-N4-kanji-value')).toHaveTextContent('53');
    expect(screen.getByText(/53 of 53 marked as known/)).toBeTruthy();
  });

  it('samples every level in a widened range and scores each one separately', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    __mockSetItems('curriculum.db.test', [
      radical(1, '一', 1),
      radical(2, '口', 2),
      kanji(11, '会', 1),
      kanji(12, '同', 2),
      kanji(21, '政', 1, 'N3'),
      kanji(22, '議', 2, 'N3'),
    ]);
    renderPlacementScreen(curriculumDb, userDb);

    await waitFor(() => {
      expect(screen.getByTestId('placement-range')).toBeTruthy();
    });

    fireEvent.press(within(screen.getByTestId('placement-range-to')).getByTestId('jlpt-level-N3'));
    fireEvent.press(screen.getByTestId('onboarding-primary-action'));

    await waitFor(() => {
      expect(screen.getByTestId('placement-screen')).toBeTruthy();
    });

    // N4 first (both known), then N3 (both unknown).
    fireEvent.press(screen.getByTestId('placement-answer-known'));
    fireEvent.press(screen.getByTestId('placement-answer-known'));
    fireEvent.press(screen.getByTestId('placement-answer-unknown'));
    fireEvent.press(screen.getByTestId('placement-answer-unknown'));

    await waitFor(() => {
      expect(screen.getByTestId('placement-summary')).toBeTruthy();
    });

    expect(screen.getByTestId('placement-known-count-N4-kanji-value')).toHaveTextContent('2');
    expect(screen.getByTestId('placement-known-count-N3-kanji-value')).toHaveTextContent('0');

    fireEvent.press(screen.getByRole('button', { name: 'Sounds right' }));

    const statuses = listStudyStatusesForItems(userDb, ['1', '11', '12', '21', '22']);
    expect(statuses.get('1')).toBe('known');
    expect(statuses.get('11')).toBe('known');
    expect(statuses.get('12')).toBe('known');
    expect(statuses.get('21')).toBeUndefined();
    expect(statuses.get('22')).toBeUndefined();
  });

  it('applies a hand-adjusted known count for a level', async () => {
    const { userDb, curriculumDb } = await createDatabases();
    renderPlacementScreen(curriculumDb, userDb);

    await startCheck();
    await waitFor(() => {
      expect(screen.getByTestId('placement-screen')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('placement-answer-known'));
    fireEvent.press(screen.getByTestId('placement-answer-known'));
    fireEvent.press(screen.getByTestId('placement-answer-unknown'));
    fireEvent.press(screen.getByTestId('placement-answer-unknown'));

    await waitFor(() => {
      expect(screen.getByTestId('placement-summary')).toBeTruthy();
    });

    // Computed 2, and 2 answered "not yet" are ruled out → 2 adjustable. Nudge
    // down to 1; the caption follows the value and the reachable denominator.
    fireEvent.press(screen.getByTestId('placement-known-count-N4-kanji-decrement'));
    expect(screen.getByTestId('placement-known-count-N4-kanji-value')).toHaveTextContent('1');
    expect(screen.getByText(/1 of 2 marked as known/)).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Sounds right' }));

    const statuses = listStudyStatusesForItems(userDb, ['11', '12']);
    expect(statuses.get('11')).toBe('known');
    expect(statuses.get('12')).toBeUndefined();
  });
});
