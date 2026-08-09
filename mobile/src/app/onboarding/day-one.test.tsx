import { fireEvent, render, screen } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration019CardSeen } from '@/data/migrations/019_card_seen';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { isCardSeen, markCardSeen } from '@/data/user/cardSeenRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import DayOneScreen from './day-one';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

function renderDayOneScreen(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
  const contextValue: DatabaseContextValue = {
    curriculumDb: userDb,
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
        <DayOneScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

async function createUserDb() {
  const db = await openDatabaseAsync('user.db');
  const result = runMigrations(db, [migration001Initial, migration019CardSeen]);
  expect(result.ok).toBe(true);
  return db;
}

describe('DayOneScreen', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  it('advances through the deck in order and then continues to complete', async () => {
    const db = await createUserDb();
    renderDayOneScreen(db);

    expect(screen.getByText('Three scripts, one language')).toBeTruthy();

    fireEvent.press(screen.getByTestId('onboarding-primary-action'));
    expect(screen.getByText('No spaces between words')).toBeTruthy();

    fireEvent.press(screen.getByTestId('onboarding-primary-action'));
    expect(mockPush).toHaveBeenCalledWith('/onboarding/complete');
  });

  it('marks a card seen the moment it is shown, not when it is dismissed', async () => {
    const db = await createUserDb();
    renderDayOneScreen(db);

    // Read back through the repository: asserting the screen "called mark"
    // would pass even if the write never landed.
    expect(isCardSeen(db, 'three-scripts')).toBe(true);
    expect(isCardSeen(db, 'word-spacing')).toBe(false);

    fireEvent.press(screen.getByTestId('onboarding-primary-action'));
    expect(isCardSeen(db, 'word-spacing')).toBe(true);
  });

  it('offers skip on the first card only, and skipping marks every deck card seen', async () => {
    const db = await createUserDb();
    renderDayOneScreen(db);

    fireEvent.press(screen.getByRole('button', { name: 'Skip all, I know how apps work' }));

    expect(isCardSeen(db, 'three-scripts')).toBe(true);
    expect(isCardSeen(db, 'word-spacing')).toBe(true);
    expect(mockPush).toHaveBeenCalledWith('/onboarding/complete');
  });

  it('hides skip once past the first card', async () => {
    const db = await createUserDb();
    renderDayOneScreen(db);

    fireEvent.press(screen.getByTestId('onboarding-primary-action'));

    expect(screen.queryByRole('button', { name: 'Skip all, I know how apps work' })).toBeNull();
  });

  it('goes straight to complete when every deck card has already been seen', async () => {
    const db = await createUserDb();
    markCardSeen(db, 'three-scripts');
    markCardSeen(db, 'word-spacing');

    renderDayOneScreen(db);

    expect(screen.queryByTestId('day-one-screen')).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/complete');
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('starts on the first unseen card when part of the deck is already seen', async () => {
    const db = await createUserDb();
    markCardSeen(db, 'three-scripts');

    renderDayOneScreen(db);

    expect(screen.getByText('No spaces between words')).toBeTruthy();
    expect(screen.queryByText('Three scripts, one language')).toBeNull();
  });
});
