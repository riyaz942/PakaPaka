import type { BackupPreview } from '@/core/backup/backup.types';
import type { ImportPreview } from '@/core/import/import.types';

let storedPreview: ImportPreview | null = null;
/**
 * Parallel slot for a PakaPaka backup restore. Same module, same
 * preview-then-confirm mechanism as a third-party import — but its own type,
 * because a backup is not an `ImportSource` (see Story 9.2 Dev Notes).
 * Setting either preview clears the other, so `import-summary` never has to
 * choose between two live previews.
 */
let storedBackupPreview: BackupPreview | null = null;

export function setImportPreview(preview: ImportPreview): void {
  storedPreview = preview;
  storedBackupPreview = null;
}

export function getImportPreview(): ImportPreview | null {
  return storedPreview;
}

export function clearImportPreview(): void {
  storedPreview = null;
}

export function setBackupPreview(preview: BackupPreview): void {
  storedBackupPreview = preview;
  storedPreview = null;
}

export function getBackupPreview(): BackupPreview | null {
  return storedBackupPreview;
}

export function clearBackupPreview(): void {
  storedBackupPreview = null;
}
