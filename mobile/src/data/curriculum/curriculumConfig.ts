import Constants from 'expo-constants';
import { documentDirectory } from 'expo-file-system/legacy';

/** Bundled mock manifest used in __DEV__ when no remote URL is configured. */
export const BUNDLED_MOCK_MANIFEST_SCHEME = 'bundled://mock-manifest';

/** Prefix for manifest download URLs that resolve to app-bundled fixture assets. */
export const BUNDLED_FIXTURE_SCHEME = 'bundled://';

export const CURRICULUM_DB_NAME = 'curriculum.db';
export const CURRICULUM_DOWNLOAD_NAME = 'curriculum.db.download';

export function getCurriculumManifestUrl(): string {
  const extra = Constants.expoConfig?.extra;
  const fromExtra =
    extra && typeof extra === 'object' && 'curriculumManifestUrl' in extra
      ? extra.curriculumManifestUrl
      : undefined;

  if (typeof fromExtra === 'string' && fromExtra.length > 0) {
    return fromExtra;
  }

  const envUrl = process.env.EXPO_PUBLIC_CURRICULUM_MANIFEST_URL;
  if (typeof envUrl === 'string' && envUrl.length > 0) {
    return envUrl;
  }

  if (__DEV__) {
    return BUNDLED_MOCK_MANIFEST_SCHEME;
  }

  return 'https://example.invalid/curriculum-manifest.json';
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

/** Keep equal to CURRICULUM_SCHEMA_VERSION in scripts/curriculum-schema.ts. */
export const REQUIRED_CURRICULUM_SCHEMA_VERSION = 1;
