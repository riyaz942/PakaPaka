import { act, renderHook } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React, { type ReactNode } from 'react';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { useGuidanceCard } from '@/data/hooks/useGuidanceCard';
import { migration001Initial } from '@/data/migrations/001_initial';
import { migration019CardSeen } from '@/data/migrations/019_card_seen';
import { runMigrations } from '@/data/migrations/migrationRunner';
import * as cardSeenRepository from '@/data/user/cardSeenRepository';
import { isCardSeen, markCardSeen } from '@/data/user/cardSeenRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

async function createUserDb() {
  const userDb = await openDatabaseAsync('user.db');
  const result = runMigrations(userDb, [migration001Initial, migration019CardSeen]);
  expect(result.ok).toBe(true);
  return userDb;
}

function wrapperFor(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
  const contextValue = {
    curriculumDb: userDb,
    userDb,
    isReady: true,
    error: null,
  } as unknown as DatabaseContextValue;

  return function Wrapper({ children }: { children: ReactNode }) {
    return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>;
  };
}

function renderCard(
  userDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
  initialActive: boolean,
) {
  return renderHook(({ active }: { active: boolean }) => useGuidanceCard('first-miss', active), {
    wrapper: wrapperFor(userDb),
    initialProps: { active: initialActive },
  });
}

describe('useGuidanceCard', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('stays hidden and writes nothing while inactive', async () => {
    const userDb = await createUserDb();

    const { result } = renderCard(userDb, false);

    expect(result.current.visible).toBe(false);
    expect(isCardSeen(userDb, 'first-miss')).toBe(false);
  });

  it('shows an unseen card and marks it seen the moment it becomes visible', async () => {
    const userDb = await createUserDb();

    const { result } = renderCard(userDb, true);

    expect(result.current.visible).toBe(true);
    // Written on visible, not on dismiss — leaving the screen still counts.
    expect(isCardSeen(userDb, 'first-miss')).toBe(true);
  });

  it('never shows a card that has already been seen', async () => {
    const userDb = await createUserDb();
    markCardSeen(userDb, 'first-miss');

    const { result } = renderCard(userDb, true);

    expect(result.current.visible).toBe(false);
  });

  it('fires once per mounted surface, however often the condition swings', async () => {
    const userDb = await createUserDb();

    const { result, rerender } = renderCard(userDb, false);
    expect(result.current.visible).toBe(false);

    rerender({ active: true });
    expect(result.current.visible).toBe(true);

    // Next prompt: the notice must not sit over it.
    rerender({ active: false });
    expect(result.current.visible).toBe(false);

    // A second wrong answer in the same session does not bring it back.
    rerender({ active: true });
    expect(result.current.visible).toBe(false);
  });

  it('stays hidden after dismiss, including across a later condition swing', async () => {
    const userDb = await createUserDb();

    const { result, rerender } = renderCard(userDb, true);
    expect(result.current.visible).toBe(true);

    act(() => result.current.dismiss());
    expect(result.current.visible).toBe(false);

    rerender({ active: false });
    rerender({ active: true });
    expect(result.current.visible).toBe(false);
  });

  it('fails closed when the seen-check throws, and can still fire on a later swing', async () => {
    const userDb = await createUserDb();
    const seenSpy = jest.spyOn(cardSeenRepository, 'isCardSeen').mockImplementationOnce(() => {
      throw new Error('db gone');
    });

    const { result, rerender } = renderCard(userDb, true);
    expect(result.current.visible).toBe(false);
    expect(seenSpy).toHaveBeenCalled();
    seenSpy.mockRestore();

    // The failed read did not settle the surface: a later swing still fires.
    rerender({ active: false });
    rerender({ active: true });
    expect(result.current.visible).toBe(true);
    expect(isCardSeen(userDb, 'first-miss')).toBe(true);
  });
});
