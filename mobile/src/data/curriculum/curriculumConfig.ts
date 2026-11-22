import { documentDirectory } from 'expo-file-system/legacy';

import { API_BASE_URL } from '@/config/api';
import { isWeb } from '@/platform/capabilities';

export const CURRICULUM_DB_NAME = 'curriculum.db';
export const CURRICULUM_DOWNLOAD_NAME = 'curriculum.db.download';

/** Keep equal to CURRICULUM_SCHEMA_VERSION in scripts/curriculum-schema.ts. */
export const REQUIRED_CURRICULUM_SCHEMA_VERSION = 2;

/** Web is served by the same Worker that hosts /api/*, so its URLs are relative. */
export function getCurriculumBaseUrl(): string {
  return isWeb() ? '' : API_BASE_URL;
}

export function getCurriculumManifestUrl(): string {
  return `${getCurriculumBaseUrl()}/api/curriculum/s${REQUIRED_CURRICULUM_SCHEMA_VERSION}/manifest.json`;
}

export function getCurriculumFileUrl(sha256: string): string {
  return `${getCurriculumBaseUrl()}/api/curriculum/files/${sha256}.db`;
}

const TEST_DOCUMENT_DIRECTORY = 'file:///mock-documents/';

function getDocumentDirectory(): string {
  const directory =
    process.env.NODE_ENV === 'test' ? TEST_DOCUMENT_DIRECTORY : documentDirectory;
  if (!directory) {
    throw new Error('documentDirectory is unavailable');
  }
  return directory;
}

export function getSqliteDirectoryUri(): string {
  return `${getDocumentDirectory()}SQLite/`;
}

export function getCurriculumDbUri(): string {
  return `${getSqliteDirectoryUri()}${CURRICULUM_DB_NAME}`;
}

export function getCurriculumDownloadUri(): string {
  return `${getSqliteDirectoryUri()}${CURRICULUM_DOWNLOAD_NAME}`;
}
