import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __mockResetSecureStore } from '../../../__mocks__/expo-secure-store';
import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { migration003SrsStatesAndImportMetadata } from '@/data/migrations/003_srs_states_and_import_metadata';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  clearBackupPreview,
  clearImportPreview,
  setBackupPreview,
  setImportPreview,
} from '@/data/import/importPreviewStore';
import type { BackupPreview } from '@/core/backup/backup.types';
import type { ImportPreview } from '@/core/import/import.types';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import ImportSummaryScreen from './import-summary';

const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

const mockConfirmCredentialedImport = jest.fn();

jest.mock('@/data/user/importRepository', () => ({
  confirmCredentialedImport: (...args: unknown[]) => mockConfirmCredentialedImport(...args),
}));

const mockRestoreBackup = jest.fn();

jest.mock('@/data/user/restoreBackup', () => ({
  restoreBackup: (...args: unknown[]) => mockRestoreBackup(...args),
}));

const backupPreview: BackupPreview = {
  bundle: {
    format: 'pakapaka-backup',
    formatVersion: 1,
    schemaVersion: 19,
    curriculumVersion: '1.4.0',
    exportedAt: '2026-08-10T00:00:00.000Z',
    includesConversations: false,
    data: {} as BackupPreview['bundle']['data'],
  },
  unmatchedSlugs: [],
  summary: {
    itemCount: 42,
    unmatchedSlugCount: 0,
    unmatchedPassageCount: 0,
    includesConversations: false,
    exportedAt: '2026-08-10T00:00:00.000Z',
    curriculumVersion: '1.4.0',
    schemaVersion: 19,
  },
};

const preview: ImportPreview = {
  source: 'wanikani',
  mapped: [],
  unmatched: [{ externalId: '999', srsStage: 4, srsStageName: 'apprentice' }],
  summary: {
    source: 'wanikani',
    mappedCount: 2,
    unmatchedCount: 1,
    burnedCount: 1,
    apprenticeCount: 1,
  },
};

function renderImportSummaryScreen(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
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
        <ImportSummaryScreen />
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('ImportSummaryScreen', () => {
  beforeEach(async () => {
    __mockResetSqlite();
    __mockResetSecureStore();
    clearImportPreview();
    clearBackupPreview();
    mockBack.mockClear();
    mockReplace.mockClear();
    mockConfirmCredentialedImport.mockReset();
    mockRestoreBackup.mockReset();
  });

  async function createUserDb() {
    const userDb = await openDatabaseAsync('user.db');
    const migrationResult = runMigrations(userDb, [
      migration001Initial,
      migration002ItemStudyStatus,
      migration003SrsStatesAndImportMetadata,
    ]);
    expect(migrationResult.ok).toBe(true);
    return userDb;
  }

  it('renders preview summary from the import preview store', async () => {
    setImportPreview(preview);
    const userDb = await createUserDb();
    renderImportSummaryScreen(userDb);

    expect(screen.getByText('Import summary')).toBeTruthy();
    expect(screen.getByText('Mapped 2 of 3')).toBeTruthy();
    expect(screen.getByText('999')).toBeTruthy();
  });

  it('navigates back on cancel without persisting', async () => {
    setImportPreview(preview);
    const userDb = await createUserDb();
    renderImportSummaryScreen(userDb);

    fireEvent.press(screen.getByRole('button', { name: 'Re-import' }));

    expect(mockBack).toHaveBeenCalled();
    expect(mockConfirmCredentialedImport).not.toHaveBeenCalled();
  });

  it('confirms import and routes to onboarding intensity', async () => {
    setImportPreview(preview);
    mockConfirmCredentialedImport.mockResolvedValue({ ok: true, value: undefined });

    const userDb = await createUserDb();
    renderImportSummaryScreen(userDb);

    fireEvent.press(screen.getByRole('button', { name: 'Confirm import' }));

    await waitFor(() => {
      expect(mockConfirmCredentialedImport).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/intensity');
    });
  });

  it('shows error state when no preview is available', async () => {
    const userDb = await createUserDb();
    renderImportSummaryScreen(userDb);

    expect(screen.getByText('No import preview available. Please try importing again.')).toBeTruthy();
  });

  it('shows error state when confirm fails', async () => {
    setImportPreview(preview);
    mockConfirmCredentialedImport.mockResolvedValue({
      ok: false,
      error: { code: 'import_persist_failed', message: 'Persist failed', userMessage: 'Could not save import.' },
    });

    const userDb = await createUserDb();
    renderImportSummaryScreen(userDb);

    fireEvent.press(screen.getByRole('button', { name: 'Confirm import' }));

    await waitFor(() => {
      expect(screen.getByText('Could not save import.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  describe('backup restore branch (Story 9.2, AC1/AC2/AC8)', () => {
    it('renders the restore preview instead of the import summary', async () => {
      setBackupPreview(backupPreview);
      const userDb = await createUserDb();
      renderImportSummaryScreen(userDb);

      expect(screen.getByText('Restore summary')).toBeTruthy();
      expect(screen.getByTestId('restore-preview-item-count')).toHaveTextContent(/42 rows/);
      expect(screen.getByTestId('restore-preview-warning')).toHaveTextContent(
        'This replaces your current progress on this device.',
      );
      expect(screen.queryByText('Import summary')).toBeNull();
    });

    it('writes nothing until the learner confirms', async () => {
      setBackupPreview(backupPreview);
      const userDb = await createUserDb();
      renderImportSummaryScreen(userDb);

      expect(mockRestoreBackup).not.toHaveBeenCalled();
      fireEvent.press(screen.getByTestId('restore-preview-cancel'));

      expect(mockBack).toHaveBeenCalled();
      expect(mockRestoreBackup).not.toHaveBeenCalled();
    });

    it('restores with onboarding origin and skips intensity and placement', async () => {
      setBackupPreview(backupPreview);
      mockRestoreBackup.mockReturnValue({
        ok: true,
        value: { restoredRowCount: 42, unmatchedSlugCount: 0, unmatchedPassageCount: 0 },
      });

      const userDb = await createUserDb();
      renderImportSummaryScreen(userDb);

      fireEvent.press(screen.getByTestId('restore-preview-confirm'));

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/onboarding/complete?restored=1');
      });
      expect(mockRestoreBackup).toHaveBeenCalledWith(expect.anything(), backupPreview, 'onboarding');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/intensity');
    });

    it('stays put and explains when the restore write fails', async () => {
      setBackupPreview(backupPreview);
      mockRestoreBackup.mockReturnValue({
        ok: false,
        error: {
          code: 'BACKUP_RESTORE_FAILED',
          message: 'disk full',
          userMessage: 'Restore could not be saved. Your previous progress was not changed.',
        },
      });

      const userDb = await createUserDb();
      renderImportSummaryScreen(userDb);

      fireEvent.press(screen.getByTestId('restore-preview-confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('restore-preview-error')).toHaveTextContent(
          /Your previous progress was not changed/,
        );
      });
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
