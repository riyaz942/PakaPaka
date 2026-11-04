import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSecureStore } from '../../../__mocks__/expo-secure-store';
import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  getOnboardingPath,
  getStartingJlptLevel,
  setOnboardingPath,
} from '@/data/user/preferencesRepository';
import { clearBackupPreview, getBackupPreview } from '@/data/import/importPreviewStore';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import ImportScreen from './import';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
  },
}));

const mockGetDocumentAsync = jest.fn();

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (options: unknown) => mockGetDocumentAsync(options),
}));

const mockPreviewRestore = jest.fn();

jest.mock('@/data/user/restoreBackup', () => ({
  previewRestore: (db: unknown, uri: string) => mockPreviewRestore(db, uri),
}));

jest.mock('@/data/user/credentialStore', () => ({
  saveImportCredential: jest.fn(),
}));

jest.mock('@/data/user/importRepository', () => ({
  previewWaniKaniImport: jest.fn(),
  previewBunproImport: jest.fn(),
  previewAnkiImport: jest.fn(),
}));

const NETWORK_NOTICE =
  'Requires a one-time internet connection. Data stays on your device after import.';

function renderImportScreen(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
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
        <ImportScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('ImportScreen', () => {
  beforeEach(async () => {
    __mockResetSqlite();
    __mockResetSecureStore();
    mockPush.mockClear();
    mockBack.mockClear();
    mockGetDocumentAsync.mockReset();
    mockPreviewRestore.mockReset();
    clearBackupPreview();
  });

  async function createUserDb() {
    const db = await openDatabaseAsync('user.db');
    const result = runMigrations(db, [migration001Initial]);
    expect(result.ok).toBe(true);
    return db;
  }

  it('shows FR50 network notice on the WaniKani panel', async () => {
    const db = await createUserDb();
    renderImportScreen(db);

    expect(screen.getByText(NETWORK_NOTICE)).toBeTruthy();
  });

  it('shows FR50 network notice on the Bunpro panel', async () => {
    const db = await createUserDb();
    renderImportScreen(db);

    fireEvent.press(screen.getByText('Bunpro'));

    expect(screen.getByText(NETWORK_NOTICE)).toBeTruthy();
  });

  it('shows on-device copy on the Anki panel', async () => {
    const db = await createUserDb();
    renderImportScreen(db);

    fireEvent.press(screen.getByText('Anki'));

    expect(
      screen.getByText('Your deck file is processed entirely on this device. No data is sent to any server.'),
    ).toBeTruthy();
  });

  it('routes skip import to intensity with manual onboarding path', async () => {
    const db = await createUserDb();
    setOnboardingPath(db, 'import');
    renderImportScreen(db);

    fireEvent.press(screen.getByRole('button', { name: 'Mark manually instead' }));

    expect(getStartingJlptLevel(db)).toBe('N3');
    expect(getOnboardingPath(db)).toBe('manual');
    expect(mockPush).toHaveBeenCalledWith('/onboarding/intensity');
  });

  it('persists selected JLPT level when skipping import', async () => {
    const db = await createUserDb();
    renderImportScreen(db);

    fireEvent.press(screen.getByTestId('jlpt-level-N2'));
    fireEvent.press(screen.getByRole('button', { name: 'Mark manually instead' }));

    expect(getStartingJlptLevel(db)).toBe('N2');
    expect(mockPush).toHaveBeenCalledWith('/onboarding/intensity');
  });

  describe('Kizamu backup restore (Story 9.2, AC7)', () => {
    it('offers restore alongside the third-party sources', async () => {
      const db = await createUserDb();
      renderImportScreen(db);

      expect(screen.getByTestId('onboarding-import-restore-backup')).toBeTruthy();
      expect(screen.getByText(/not another study tool/)).toBeTruthy();
    });

    it('previews the picked backup without requiring a JLPT level', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///picked/kizamu-backup.json.gz' }],
      });
      const previewValue = { bundle: {}, unmatchedSlugs: [], summary: { itemCount: 5 } };
      mockPreviewRestore.mockResolvedValue({ ok: true, value: previewValue });

      const db = await createUserDb();
      renderImportScreen(db);

      // Deliberately no JLPT tap: the backup carries starting_jlpt_level.
      fireEvent.press(screen.getByTestId('onboarding-import-restore-backup'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('./import-summary');
      });
      expect(mockPreviewRestore).toHaveBeenCalledWith(db, 'file:///picked/kizamu-backup.json.gz');
      expect(getBackupPreview()).toBe(previewValue);
    });

    it('does not navigate if the learner left during preview', async () => {
      let resolvePreview: (value: unknown) => void = () => {};
      mockPreviewRestore.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePreview = resolve;
          }),
      );
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///picked/kizamu-backup.json.gz' }],
      });

      const db = await createUserDb();
      const { unmount } = renderImportScreen(db);
      fireEvent.press(screen.getByTestId('onboarding-import-restore-backup'));

      await waitFor(() => {
        expect(mockPreviewRestore).toHaveBeenCalled();
      });
      unmount();

      await act(async () => {
        resolvePreview({
          ok: true,
          value: { bundle: {}, unmatchedSlugs: [], summary: { itemCount: 5 } },
        });
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(getBackupPreview()).toBeNull();
    });

    it('treats a cancelled picker as a no-op', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: true });

      const db = await createUserDb();
      renderImportScreen(db);

      fireEvent.press(screen.getByTestId('onboarding-import-restore-backup'));

      await waitFor(() => {
        expect(mockGetDocumentAsync).toHaveBeenCalled();
      });
      expect(mockPreviewRestore).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('shows a corrupt-file message instead of navigating', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///picked/notes.txt' }],
      });
      mockPreviewRestore.mockResolvedValue({
        ok: false,
        error: {
          code: 'BACKUP_INVALID_GZIP',
          message: 'incorrect header check',
          userMessage: 'That file is not a Kizamu backup. Pick the .json.gz file you exported.',
        },
      });

      const db = await createUserDb();
      renderImportScreen(db);

      fireEvent.press(screen.getByTestId('onboarding-import-restore-backup'));

      await waitFor(() => {
        expect(screen.getByText(/not a Kizamu backup/)).toBeTruthy();
      });
      expect(mockPush).not.toHaveBeenCalled();
      expect(getBackupPreview()).toBeNull();
    });
  });

  describe('on web', () => {
    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    });

    it('offers WaniKani, Bunpro and Anki on native', async () => {
      const db = await createUserDb();
      renderImportScreen(db);

      expect(screen.getByText('WaniKani')).toBeTruthy();
      expect(screen.getByText('Bunpro')).toBeTruthy();
      expect(screen.getByText('Anki')).toBeTruthy();
    });

    it('offers only the backup restore, not the third-party sources', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
      const db = await createUserDb();
      renderImportScreen(db);

      expect(screen.queryByText('WaniKani')).toBeNull();
      expect(screen.queryByText('Bunpro')).toBeNull();
      expect(screen.queryByText('Anki')).toBeNull();
      expect(screen.queryByText(NETWORK_NOTICE)).toBeNull();
      expect(screen.queryByText('Import from WaniKani')).toBeNull();
      expect(screen.getByTestId('onboarding-import-restore-backup')).toBeTruthy();
    });
  });
});
