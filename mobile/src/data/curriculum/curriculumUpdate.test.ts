import { createHash, sign, type KeyObject } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  getMockFileContents,
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
  canDownloadCurriculumUpdate,
  checkForCurriculumUpdate,
  computeFileSha256Hex,
  downloadAndSwapCurriculum,
  validateDownloadedCurriculumFile,
} from '@/data/curriculum/curriculumUpdate';
import {
  getCurriculumDownloadUri,
  getCurriculumFileUrl,
} from '@/data/curriculum/curriculumConfig';
import {
  holdCurriculumSwap,
  resetCurriculumSwapGateForTests,
} from '@/data/curriculum/curriculumSwapGate';
import type { CurriculumRelease } from '@/data/curriculum/curriculumManifest.types';
import { initializeDatabases, openCurriculumDatabase } from '@/data/database';
import { migrations } from '@/data/migrations';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  getPreference,
  PREFERENCE_KEYS,
  setCurriculumInstallMetadata,
} from '@/data/user/preferencesRepository';
import * as fileSystem from 'expo-file-system/legacy';
import { openDatabaseAsync } from 'expo-sqlite';

// jest-expo registers its own expo-file-system/legacy mock, which wins over the
// moduleNameMapper entry; use the in-memory file store mock for the download.
jest.mock('expo-file-system/legacy', () => jest.requireActual('../../../__mocks__/expo-file-system'));

// Keeps the real verifySignedManifest; only the trusted keys are replaced by a
// test key pair made inside the factory (it runs before the test file body).
jest.mock('@/core/curriculum/manifestSignature', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factory scope
  const { generateKeyPairSync: generate } = require('node:crypto') as typeof import('node:crypto');
  const { publicKey, privateKey } = generate('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  return {
    ...jest.requireActual('@/core/curriculum/manifestSignature'),
    SIGNING_KEYS: { k1: raw.toString('base64') },
    __testPrivateKey: privateKey,
  };
});

const { __testPrivateKey: TEST_PRIVATE_KEY } = jest.requireMock(
  '@/core/curriculum/manifestSignature',
) as { __testPrivateKey: KeyObject };

const MANIFEST_URL = 'https://paka-paka.app/api/curriculum/s1/manifest.json';

const FIXTURE_DB_PATH = path.join(
  __dirname,
  '../../../assets/curriculum-manifest/curriculum-mock-update.db',
);

function fixtureBase64(): string {
  return readFileSync(FIXTURE_DB_PATH).toString('base64');
}

function fixtureSha256Hex(): string {
  return createHash('sha256').update(readFileSync(FIXTURE_DB_PATH)).digest('hex');
}

function signedManifest({
  version,
  sha256,
  schema = 1,
}: {
  version: number;
  sha256: string;
  schema?: number;
}) {
  const payload = Buffer.from(
    JSON.stringify({
      schema,
      version,
      sha256,
      size_bytes: 1234,
      published_at: '2026-11-19T00:00:00.000Z',
    }),
  );
  return {
    format: 'pakapaka-curriculum-manifest',
    formatVersion: 1,
    keyId: 'k1',
    payload: payload.toString('base64'),
    signature: sign(null, payload, TEST_PRIVATE_KEY).toString('base64'),
  };
}

function serveManifest(manifest: unknown) {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => manifest,
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function release(version: number, sha256: string = fixtureSha256Hex()): CurriculumRelease {
  return {
    schema: 1,
    version,
    sha256,
    sizeBytes: 1234,
    publishedAt: '2026-11-19T00:00:00.000Z',
    keyId: 'k1',
  };
}

function seedDownloadSource(sha256: string = fixtureSha256Hex()) {
  setMockFileContents(getCurriculumFileUrl(sha256), fixtureBase64());
}

const originalFetch = global.fetch;

describe('curriculumUpdate', () => {
  beforeEach(() => {
    __mockResetSqlite();
    resetMockFileSystem();
    resetMockNetwork();
    resetCurriculumSwapGateForTests();
    setMockNetworkState({ isConnected: true, isWifi: true });
    setMockCurriculumFixtureBase64(fixtureBase64());
    setMockCurriculumSwapCallback(__mockApplyDownloadedCurriculumToActive);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe('checkForCurriculumUpdate', () => {
    it('returns the release when the signed version is newer', async () => {
      serveManifest(signedManifest({ version: 2, sha256: fixtureSha256Hex() }));

      const result = await checkForCurriculumUpdate('1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value?.version).toBe(2);
        expect(result.value?.sha256).toBe(fixtureSha256Hex());
      }
    });

    it('returns null when local is already current', async () => {
      serveManifest(signedManifest({ version: 2, sha256: fixtureSha256Hex() }));

      const result = await checkForCurriculumUpdate('2');
      expect(result).toEqual({ ok: true, value: null });
    });

    it('an older signed manifest is ignored', async () => {
      serveManifest(signedManifest({ version: 2, sha256: fixtureSha256Hex() }));

      const result = await checkForCurriculumUpdate('3');
      expect(result).toEqual({ ok: true, value: null });
    });

    it('a rejected manifest returns null and makes no file request', async () => {
      const manifest = signedManifest({ version: 2, sha256: fixtureSha256Hex() });
      const tampered = {
        ...manifest,
        payload: Buffer.from(
          JSON.stringify({
            schema: 1,
            version: 9,
            sha256: fixtureSha256Hex(),
            size_bytes: 1234,
            published_at: '2026-11-19T00:00:00.000Z',
          }),
        ).toString('base64'),
      };
      serveManifest(tampered);
      const downloadSpy = jest.spyOn(fileSystem, 'downloadAsync');

      const result = await checkForCurriculumUpdate('1');
      expect(result).toEqual({ ok: true, value: null });
      expect(downloadSpy).not.toHaveBeenCalled();
    });

    it('a manifest for another schema returns null', async () => {
      serveManifest(signedManifest({ version: 2, sha256: fixtureSha256Hex(), schema: 2 }));

      const result = await checkForCurriculumUpdate('1');
      expect(result).toEqual({ ok: true, value: null });
    });

    it('requests the s1 manifest under API_BASE_URL', async () => {
      const fetchMock = serveManifest(signedManifest({ version: 2, sha256: fixtureSha256Hex() }));

      await checkForCurriculumUpdate('1');
      expect(fetchMock).toHaveBeenCalledWith(MANIFEST_URL);
    });
  });

  describe('validateDownloadedCurriculumFile', () => {
    it('rejects checksum mismatch', async () => {
      const tempUri = getCurriculumDownloadUri();
      setMockFileContents(tempUri, fixtureBase64());

      const result = await validateDownloadedCurriculumFile(tempUri, release(2, '0'.repeat(64)));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CURRICULUM_CHECKSUM_MISMATCH');
      }
    });

    it('accepts fixture file with matching checksum and version', async () => {
      const tempUri = getCurriculumDownloadUri();
      setMockFileContents(tempUri, fixtureBase64());

      const result = await validateDownloadedCurriculumFile(tempUri, release(2));
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

      serveManifest(signedManifest({ version: 2, sha256: fixtureSha256Hex() }));
      const checked = await checkForCurriculumUpdate('1');
      if (!checked.ok || !checked.value) {
        throw new Error('expected a signed release');
      }
      seedDownloadSource();

      const swapResult = await downloadAndSwapCurriculum(checked.value, {
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
      expect(getPreference(init.value.userDb, PREFERENCE_KEYS.installedCurriculumContentHash)).toBe(
        fixtureSha256Hex(),
      );

      const metadata = swapResult.value.curriculumDb.getFirstSync<{ version: string }>(
        'SELECT version FROM curriculum_metadata LIMIT 1',
      );
      expect(metadata?.version).toBe('2');
    });

    it('leaves prior curriculum when the checksum does not match', async () => {
      const init = await initializeDatabases();
      expect(init.ok).toBe(true);
      if (!init.ok) {
        return;
      }

      const badRelease = release(2, '0'.repeat(64));
      seedDownloadSource(badRelease.sha256);
      const swapResult = await downloadAndSwapCurriculum(badRelease, init.value);

      expect(swapResult.ok).toBe(false);

      const metadata = init.value.curriculumDb.getFirstSync<{ version: string }>(
        'SELECT version FROM curriculum_metadata LIMIT 1',
      );
      expect(metadata?.version).toBe('1');
    });

    it('rejects a file whose version differs from the signed version', async () => {
      const init = await initializeDatabases();
      expect(init.ok).toBe(true);
      if (!init.ok) {
        return;
      }

      seedDownloadSource();
      const swapResult = await downloadAndSwapCurriculum(release(3), init.value);

      expect(swapResult.ok).toBe(false);
      if (!swapResult.ok) {
        expect(swapResult.error.code).toBe('CURRICULUM_SQLITE_INVALID');
      }
      const metadata = init.value.curriculumDb.getFirstSync<{ version: string }>(
        'SELECT version FROM curriculum_metadata LIMIT 1',
      );
      expect(metadata?.version).toBe('1');
      expect(getMockFileContents(getCurriculumDownloadUri())).toBeUndefined();
    });

    it('a failed download leaves the prior curriculum and deletes the temp file', async () => {
      const init = await initializeDatabases();
      expect(init.ok).toBe(true);
      if (!init.ok) {
        return;
      }

      const swapResult = await downloadAndSwapCurriculum(release(2), init.value);

      expect(swapResult.ok).toBe(false);
      if (!swapResult.ok) {
        expect(swapResult.error.code).toBe('CURRICULUM_DOWNLOAD_FAILED');
      }
      const metadata = init.value.curriculumDb.getFirstSync<{ version: string }>(
        'SELECT version FROM curriculum_metadata LIMIT 1',
      );
      expect(metadata?.version).toBe('1');
      expect(getMockFileContents(getCurriculumDownloadUri())).toBeUndefined();
    });

    it('waits for the swap gate before closing the curriculum', async () => {
      const init = await initializeDatabases();
      expect(init.ok).toBe(true);
      if (!init.ok) {
        return;
      }

      seedDownloadSource();
      const closeSpy = jest.spyOn(init.value.curriculumDb, 'closeAsync');
      const releaseGate = holdCurriculumSwap();

      let finished = false;
      const swapPromise = downloadAndSwapCurriculum(release(2), init.value).then((result) => {
        finished = true;
        return result;
      });

      for (let i = 0; i < 20; i += 1) {
        await Promise.resolve();
      }
      expect(finished).toBe(false);
      expect(closeSpy).not.toHaveBeenCalled();

      releaseGate();
      const swapResult = await swapPromise;
      expect(swapResult.ok).toBe(true);
      expect(closeSpy).toHaveBeenCalled();
    });

    it('user.db in a transaction defers the swap', async () => {
      const init = await initializeDatabases();
      expect(init.ok).toBe(true);
      if (!init.ok) {
        return;
      }

      seedDownloadSource();
      jest.spyOn(init.value.userDb, 'isInTransactionAsync').mockResolvedValue(true);

      const swapResult = await downloadAndSwapCurriculum(release(2), init.value);

      expect(swapResult.ok).toBe(false);
      if (!swapResult.ok) {
        expect(swapResult.error.code).toBe('CURRICULUM_DOWNLOAD_DEFERRED');
      }
      const metadata = init.value.curriculumDb.getFirstSync<{ version: string }>(
        'SELECT version FROM curriculum_metadata LIMIT 1',
      );
      expect(metadata?.version).toBe('1');
      expect(getMockFileContents(getCurriculumDownloadUri())).toBeUndefined();
    });
  });

  describe('canDownloadCurriculumUpdate', () => {
    it('downloads only on Wi-Fi on native', async () => {
      setMockNetworkState({ isConnected: true, isWifi: false });
      expect(await canDownloadCurriculumUpdate()).toBe(false);

      setMockNetworkState({ isConnected: true, isWifi: true });
      expect(await canDownloadCurriculumUpdate()).toBe(true);
    });
  });

  describe('computeFileSha256Hex', () => {
    it('matches node digest for fixture bytes', async () => {
      const tempUri = getCurriculumDownloadUri();
      setMockFileContents(tempUri, fixtureBase64());

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
