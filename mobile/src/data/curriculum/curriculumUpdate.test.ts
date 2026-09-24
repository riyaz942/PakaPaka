import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  resetMockFileSystem,
  setMockCurriculumFixtureBase64,
  setMockCurriculumSwapCallback,
  setMockFileContents,
} from '../../../test-support/file-system-test-state';
import {
  resetMockNetwork,
  setMockNetworkState,
} from '../../../test-support/network-test-state';
import {
  __mockApplyDownloadedCurriculumToActive,
  __mockClearImportedAssets,
  __mockGetImportedAssetCount,
  __mockGetLastImportForceOverwrite,
  __mockResetSqlite,
  __mockSetCurriculumMetadata,
} from '../../../__mocks__/expo-sqlite';

import {
  checkForCurriculumUpdate,
  computeFileSha256Hex,
  downloadAndSwapCurriculum,
  parseCurriculumManifest,
  validateDownloadedCurriculumFile,
} from '@/data/curriculum/curriculumUpdate';
import { getCurriculumDownloadUri } from '@/data/curriculum/curriculumConfig';
import { initializeDatabases, openCurriculumDatabase } from '@/data/database';
import { migrations } from '@/data/migrations';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  getPreference,
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
    setMockCurriculumFixtureBase64(fixtureSha256Base64());
    setMockCurriculumSwapCallback(__mockApplyDownloadedCurriculumToActive);
  });

  describe('parseCurriculumManifest', () => {
    it('parses a valid manifest', () => {
      const result = parseCurriculumManifest(MOCK_MANIFEST);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.version).toBe('2');
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
      const result = await checkForCurriculumUpdate('1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value?.version).toBe('2');
      }
    });

    it('returns null when local is already current', async () => {
      const result = await checkForCurriculumUpdate('2');
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
        expect(result.value.version).toBe('2');
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

      expect(swapResult.value.version).toBe('2');

      const installedVersion = init.value.userDb.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.installedCurriculumVersion,
      );
      const updateSource = init.value.userDb.getFirstSync<{ value: string }>(
        'SELECT value FROM user_preferences WHERE key = ?',
        PREFERENCE_KEYS.curriculumUpdateSource,
      );

      expect(installedVersion?.value).toBe('2');
      expect(updateSource?.value).toBe('downloaded');

      const metadata = swapResult.value.curriculumDb.getFirstSync<{ version: string }>(
        'SELECT version FROM curriculum_metadata LIMIT 1',
      );
      expect(metadata?.version).toBe('2');
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
      expect(metadata?.version).toBe('1');
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
      version: '2',
      source: 'downloaded',
    });
    __mockApplyDownloadedCurriculumToActive();

    const result = await openCurriculumDatabase(userDb);
    expect(result.ok).toBe(true);
    expect(__mockGetImportedAssetCount()).toBe(0);
  });

  it('keeps the installed curriculum when its version equals the bundled seed', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, migrations);
    expect((await openCurriculumDatabase(userDb)).ok).toBe(true);

    // A different build date alone does not trigger a re-import.
    __mockSetCurriculumMetadata('curriculum.db', {
      version: '1',
      build_date: '2026-05-01T00:00:00.000Z',
      content_hash: 'old-hash',
    });
    __mockClearImportedAssets();

    expect((await openCurriculumDatabase(userDb)).ok).toBe(true);
    expect(__mockGetImportedAssetCount()).toBe(0);
  });

  it('re-imports when an app update ships a newer bundled seed version', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, migrations);
    expect((await openCurriculumDatabase(userDb)).ok).toBe(true);

    // Installed before whole-number versions: parses as 0, older than seed 1.
    __mockSetCurriculumMetadata('curriculum.db', {
      version: '1.13.1-jlpt-first-bands',
      build_date: '2026-05-01T00:00:00.000Z',
      content_hash: 'old-hash',
    });
    __mockClearImportedAssets();

    const result = await openCurriculumDatabase(userDb);
    expect(result.ok).toBe(true);
    expect(__mockGetImportedAssetCount()).toBe(1);
    expect(__mockGetLastImportForceOverwrite()).toBe(true);
    expect(getPreference(userDb, PREFERENCE_KEYS.installedCurriculumContentHash)).toBe(
      'mock-content-hash',
    );
    expect(getPreference(userDb, PREFERENCE_KEYS.curriculumUpdateSource)).toBe('bundled');
  });

  it('replaces a downloaded curriculum only when the bundled version is newer', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, migrations);
    setCurriculumInstallMetadata(userDb, { version: '0', source: 'downloaded' });
    __mockSetCurriculumMetadata('curriculum.db', {
      version: '0',
      build_date: '2026-04-01T00:00:00.000Z',
      content_hash: 'old-hash',
    });

    const result = await openCurriculumDatabase(userDb);
    expect(result.ok).toBe(true);
    expect(__mockGetImportedAssetCount()).toBe(1);
    expect(__mockGetLastImportForceOverwrite()).toBe(true);
    expect(getPreference(userDb, PREFERENCE_KEYS.installedCurriculumVersion)).toBe('1');
    expect(getPreference(userDb, PREFERENCE_KEYS.curriculumUpdateSource)).toBe('bundled');
  });
});
