import type { ImportPreview } from '@/core/import/import.types';

let storedPreview: ImportPreview | null = null;

export function setImportPreview(preview: ImportPreview): void {
  storedPreview = preview;
}

export function getImportPreview(): ImportPreview | null {
  return storedPreview;
}

export function clearImportPreview(): void {
  storedPreview = null;
}
