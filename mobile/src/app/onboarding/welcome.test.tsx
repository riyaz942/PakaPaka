import { fireEvent, render, screen } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSqlite, __mockSetItems } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  getOnboardingPath,
  getStartingJlptLevel,
} from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import WelcomeScreen from './welcome';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

function renderWelcomeScreen(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
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
        <WelcomeScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('WelcomeScreen', () => {
  beforeEach(async () => {
    __mockResetSqlite();
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);

    // The screen doubles as the curriculum handle here; N5–N3 ship content,
    // N2 and N1 do not. Grammar is what marks a level startable — a level with
    // only kanji and derived words is the N3+ skeleton, which explains nothing
    // on its own.
    __mockSetItems(
      'user.db',
      ['N5', 'N4', 'N3'].map((level, index) => ({
        id: index + 1,
        item_type: 'grammar',
        jlpt_level: level,
        slug: `slug-${index + 1}`,
        primary_form: `form-${index + 1}`,
        meaning: `meaning-${index + 1}`,
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: index + 1,
      })),
    );

    return db;
  }

  it('navigates to import when the existing knowledge card is pressed', async () => {
    const db = await createUserDb();
    renderWelcomeScreen(db);

    fireEvent.press(screen.getByTestId('path-import'));

    expect(mockPush).toHaveBeenCalledWith('/onboarding/import');
    expect(getOnboardingPath(db)).toBe('import');
  });

  it('shows the existing knowledge framing on the import card', async () => {
    const db = await createUserDb();
    renderWelcomeScreen(db);

    expect(screen.getByText('I have existing knowledge')).toBeTruthy();
  });

  it('tells users the app does not teach hiragana or katakana', async () => {
    const db = await createUserDb();
    renderWelcomeScreen(db);

    expect(screen.getByTestId('kana-note')).toHaveTextContent(/hiragana or katakana/);
  });

  it('persists N5 and routes beginner path to intensity', async () => {
    const db = await createUserDb();
    renderWelcomeScreen(db);

    fireEvent.press(screen.getByTestId('path-beginner'));
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(getStartingJlptLevel(db)).toBe('N5');
    expect(getOnboardingPath(db)).toBe('beginner');
    expect(mockPush).toHaveBeenCalledWith('/onboarding/intensity');
  });

  it('persists selected JLPT level and routes intermediate path to intensity', async () => {
    const db = await createUserDb();
    renderWelcomeScreen(db);

    fireEvent.press(screen.getByTestId('path-intermediate'));
    fireEvent.press(screen.getByTestId('jlpt-level-N3'));
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(getStartingJlptLevel(db)).toBe('N3');
    expect(getOnboardingPath(db)).toBe('manual');
    expect(mockPush).toHaveBeenCalledWith('/onboarding/intensity');
  });

  it('does not offer levels with no curriculum content', async () => {
    const db = await createUserDb();
    renderWelcomeScreen(db);

    fireEvent.press(screen.getByTestId('path-intermediate'));

    // Starting on an unauthored level leaves the placement check nothing to ask
    // about, which used to mark the whole shipped curriculum known instead.
    expect(screen.getByTestId('jlpt-level-N1').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('jlpt-level-N3').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(screen.getByTestId('jlpt-level-N1'));
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(getStartingJlptLevel(db)).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  describe('third-party import pills', () => {
    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    });

    it('shows WaniKani, Bunpro and Anki pills on native', async () => {
      const db = await createUserDb();
      renderWelcomeScreen(db);

      expect(screen.getByText('WaniKani API')).toBeTruthy();
      expect(screen.getByText('Bunpro')).toBeTruthy();
      expect(screen.getByText('Anki (.apkg)')).toBeTruthy();
    });

    it('hides the pills on web, where only a backup restore is possible', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
      const db = await createUserDb();
      renderWelcomeScreen(db);

      expect(screen.queryByText('WaniKani API')).toBeNull();
      expect(screen.queryByText('Bunpro')).toBeNull();
      expect(screen.queryByText('Anki (.apkg)')).toBeNull();
      expect(screen.getByTestId('path-import')).toBeTruthy();
      expect(screen.queryByText(/WaniKani/)).toBeNull();
      expect(screen.getByText(/backup/i)).toBeTruthy();
    });
  });
});
