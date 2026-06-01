import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  resetMockFileSystem,
  setMockFileContents,
} from '../../../test-support/file-system-test-state';
import {
  resetMockNetwork,
  setMockNetworkState,
} from '../../../test-support/network-test-state';
import {
  __mockClearImportedAssets,
  __mockGetImportedAssetCount,
  __mockResetSqlite,
} from '../../../__mocks__/expo-sqlite';

import {
  checkForCurriculumUpdate,
  computeFileSha256Hex,
  downloadAndSwapCurriculum,
  isCurriculumVersionNewer,
  parseCurriculumManifest,
  validateDownloadedCurriculumFile,
} from '@/data/curriculum/curriculumUpdate';
import { getCurriculumDownloadUri } from '@/data/curriculum/curriculumConfig';
import { initializeDatabases, openCurriculumDatabase } from '@/data/database';
import { migrations } from '@/data/migrations';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  PREFERENCE_KEYS,
  setCurriculumInstallMetadata,
} from '@/data/user/preferencesRepository';
import { openDatabaseAsync } from 'expo-sqlite';

const MOCK_MANIFEST = require('@/assets/curriculum-manifest/mock-manifest.json') as {
  version: string;
  url: string;
  sha256: string;
};

const FIXTURE_DB_PATH = path.join(
  __dirname,
  '../../../assets/curriculum-manifest/curriculum-mock-update.db',
);

function fixtureSha256Base64(): string {
  return readFileSync(FIXTURE_DB_PATH).toString('base64');
}

function fixtureSha256Hex(): string {
  return createHash('sha256').update(readFileSync(FIXTURE_DB_PATH)).digest('hex');
}

describe('curriculumUpdate', () => {
  beforeEach(() => {
    __mockResetSqlite();
    resetMockFileSystem();
    resetMockNetwork();
    setMockNetworkState({ isConnected: true, isWifi: true });
  });

  describe('isCurriculumVersionNewer', () => {
    it('returns true when remote semver is newer than local seed', () => {
      expect(isCurriculumVersionNewer('1.0.1-n5-seed-mock', '1.0.0-n5-seed')).toBe(true);
    });

    it('returns false when versions are equal or older', () => {
      expect(isCurriculumVersionNewer('1.0.0-n5-seed', '1.0.0-n5-seed')).toBe(false);
      expect(isCurriculumVersionNewer('0.9.0-n5-seed', '1.0.0-n5-seed')).toBe(false);
    });
  });

  describe('parseCurriculumManifest', () => {
    it('parses a valid manifest', () => {
      const result = parseCurriculumManifest(MOCK_MANIFEST);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.version).toBe('1.0.1-n5-seed-mock');
        expect(result.value.sha256).toBe(MOCK_MANIFEST.sha256.toLowerCase());
      }
    });

    it('rejects invalid sha256', () => {
      const result = parseCurriculumManifest({ ...MOCK_MANIFEST, sha256: 'short' });
      expect(result.ok).toBe(false);
    });
  });

  describe('checkForCurriculumUpdate', () => {
    it('returns manifest when remote is newer', async () => {
      const result = await checkForCurriculumUpdate('1.0.0-n5-seed');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value?.version).toBe('1.0.1-n5-seed-mock');
      }
    });

    it('returns null when local is already current', async () => {
      const result = await checkForCurriculumUpdate('1.0.1-n5-seed-mock');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe('validateDownloadedCurriculumFile', () => {
    it('rejects checksum mismatch', async () => {
      const tempUri = getCurriculumDownloadUri();
      setMockFileContents(tempUri, fixtureSha256Base64());

      const result = await validateDownloadedCurriculumFile(tempUri, '0'.repeat(64));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CURRICULUM_CHECKSUM_MISMATCH');
      }
    });

    it('accepts fixture file with matching checksum', async () => {
      const tempUri = getCurriculumDownloadUri();
      setMockFileContents(tempUri, fixtureSha256Base64());

      const result = await validateDownloadedCurriculumFile(tempUri, fixtureSha256Hex());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.version).toBe('1.0.1-n5-seed-mock');
      }
    });
  });

  describe('downloadAndSwapCurriculum', () => {
    it('updates preferences and curriculum version on success', async () => {
      const init = await initializeDatabases();
      expect(init.ok).toBe(true);
      if (!init.ok) {
        return;
      }

      const swapResult = await downloadAndSwapCurriculum(MOCK_MANIFEST, {
        curriculumDb: init.value.curriculumDb,
        userDb: init.value.userDb,
      });

      if (!swapResult.ok) {
        throw new Error(`swap failed: ${swapResult.error.code} ${swapResult.error.message}`);
      }

      expect(swapResult.value.version).toBe('1.0.1-n5-seed-mock');

      const installedVersion = init.value.userDb.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.installedCurriculumVersion,
      );
      const updateSource = init.value.userDb.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.curriculumUpdateSource,
      );

      expect(installedVersion?.value).toBe('1.0.1-n5-seed-mock');
      expect(updateSource?.value).toBe('downloaded');

      const metadata = swapResult.value.curriculumDb.getFirstSync<{ version: string }>(
        'SELECT version FROM curriculum_metadata LIMIT 1',
      );
      expect(metadata?.version).toBe('1.0.1-n5-seed-mock');
    });

    it('leaves prior curriculum when checksum validation fails', async () => {
      const init = await initializeDatabases();
      expect(init.ok).toBe(true);
      if (!init.ok) {
        return;
      }

      const badManifest = { ...MOCK_MANIFEST, sha256: '0'.repeat(64) };
      const swapResult = await downloadAndSwapCurriculum(badManifest, init.value);

      expect(swapResult.ok).toBe(false);

      const metadata = init.value.curriculumDb.getFirstSync<{ version: string }>(
        'SELECT version FROM curriculum_metadata LIMIT 1',
      );
      expect(metadata?.version).toBe('1.0.0-n5-seed');
    });
  });

  describe('computeFileSha256Hex', () => {
    it('matches node digest for fixture bytes', async () => {
      const tempUri = getCurriculumDownloadUri();
      setMockFileContents(tempUri, fixtureSha256Base64());

      const result = await computeFileSha256Hex(tempUri);
      if (!result.ok) {
        throw new Error(`checksum failed: ${result.error.message}`);
      }
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(fixtureSha256Hex());
      }
    });
  });
});

describe('openCurriculumDatabase bundled import gating', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('imports bundled asset only on first launch', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, migrations);

    const first = await openCurriculumDatabase(userDb);
    expect(first.ok).toBe(true);
    expect(__mockGetImportedAssetCount()).toBe(1);

    __mockClearImportedAssets();

    const second = await openCurriculumDatabase(userDb);
    expect(second.ok).toBe(true);
    expect(__mockGetImportedAssetCount()).toBe(0);
  });

  it('skips bundled import when curriculum_update_source is downloaded', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, migrations);
    setCurriculumInstallMetadata(userDb, {
      version: '1.0.1-n5-seed-mock',
      source: 'downloaded',
    });

    const result = await openCurriculumDatabase(userDb);
    expect(result.ok).toBe(true);
    expect(__mockGetImportedAssetCount()).toBe(0);
  });
});
