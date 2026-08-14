import type { BackupPreview } from '@/core/backup/backup.types';
import type { ImportPreview } from '@/core/import/import.types';
import {
  clearBackupPreview,
  clearImportPreview,
  getBackupPreview,
  getImportPreview,
  setBackupPreview,
  setImportPreview,
} from '@/data/import/importPreviewStore';

const IMPORT_PREVIEW = {
  source: 'anki',
  summary: { mappedCount: 1, unmatchedCount: 0, burnedCount: 0, apprenticeCount: 1 },
  mapped: [],
  unmatched: [],
} as unknown as ImportPreview;

const BACKUP_PREVIEW = {
  bundle: { data: {} },
  unmatchedSlugs: [],
  summary: { itemCount: 3 },
} as unknown as BackupPreview;

describe('importPreviewStore', () => {
  beforeEach(() => {
    clearImportPreview();
    clearBackupPreview();
  });

  it('holds an import preview and a backup preview in separate slots', () => {
    setImportPreview(IMPORT_PREVIEW);
    expect(getImportPreview()).toBe(IMPORT_PREVIEW);
    expect(getBackupPreview()).toBeNull();
  });

  it('clears the import preview when a backup preview is set', () => {
    setImportPreview(IMPORT_PREVIEW);
    setBackupPreview(BACKUP_PREVIEW);

    expect(getBackupPreview()).toBe(BACKUP_PREVIEW);
    expect(getImportPreview()).toBeNull();
  });

  it('clears the backup preview when an import preview is set', () => {
    setBackupPreview(BACKUP_PREVIEW);
    setImportPreview(IMPORT_PREVIEW);

    expect(getImportPreview()).toBe(IMPORT_PREVIEW);
    expect(getBackupPreview()).toBeNull();
  });

  it('clears each slot independently', () => {
    setBackupPreview(BACKUP_PREVIEW);
    clearBackupPreview();
    expect(getBackupPreview()).toBeNull();

    setImportPreview(IMPORT_PREVIEW);
    clearImportPreview();
    expect(getImportPreview()).toBeNull();
  });
});
