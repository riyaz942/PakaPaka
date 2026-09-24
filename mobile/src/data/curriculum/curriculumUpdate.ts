import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import {
  copyAsync,
  deleteAsync,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
  moveAsync,
  readAsStringAsync,
} from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import * as Network from 'expo-network';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import {
  BUNDLED_FIXTURE_SCHEME,
  BUNDLED_MOCK_MANIFEST_SCHEME,
  CURRICULUM_DOWNLOAD_NAME,
  getCurriculumDbUri,
  getCurriculumDownloadUri,
  getCurriculumManifestUrl,
  getSqliteDirectoryUri,
} from '@/data/curriculum/curriculumConfig';
import type { CurriculumManifest } from '@/data/curriculum/curriculumManifest.types';
import { isCurriculumVersionNewer } from '@/data/curriculum/curriculumVersion';
import { attachCurriculumForQuery, reopenCurriculumDatabase } from '@/data/database';
import {
  PREFERENCE_KEYS,
  setCurriculumInstallMetadata,
} from '@/data/user/preferencesRepository';
import type { AppError, Result } from '@/types/result.types';

const MOCK_MANIFEST = require('@/assets/curriculum-manifest/mock-manifest.json') as CurriculumManifest;
const MOCK_UPDATE_DB = require('@/assets/curriculum-manifest/curriculum-mock-update.db');

export function parseCurriculumManifest(payload: unknown): Result<CurriculumManifest, AppError> {
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      error: {
        code: 'CURRICULUM_MANIFEST_INVALID',
        message: 'Manifest payload is not an object',
      },
    };
  }

  const record = payload as Record<string, unknown>;
  const version = record.version;
  const url = record.url;
  const sha256 = record.sha256;

  if (typeof version !== 'string' || typeof url !== 'string' || typeof sha256 !== 'string') {
    return {
      ok: false,
      error: {
        code: 'CURRICULUM_MANIFEST_INVALID',
        message: 'Manifest is missing version, url, or sha256',
      },
    };
  }

  if (!/^[a-f0-9]{64}$/i.test(sha256)) {
    return {
      ok: false,
      error: {
        code: 'CURRICULUM_MANIFEST_INVALID',
        message: 'Manifest sha256 must be 64 hex characters',
      },
    };
  }

  return {
    ok: true,
    value: {
      version,
      url,
      sha256: sha256.toLowerCase(),
      size_bytes: typeof record.size_bytes === 'number' ? record.size_bytes : undefined,
      published_at: typeof record.published_at === 'string' ? record.published_at : undefined,
    },
  };
}

async function fetchRemoteManifest(url: string): Promise<Result<CurriculumManifest, AppError>> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: 'CURRICULUM_MANIFEST_FETCH_FAILED',
          message: `Manifest fetch failed with status ${response.status}`,
        },
      };
    }

    const json: unknown = await response.json();
    return parseCurriculumManifest(json);
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'CURRICULUM_MANIFEST_FETCH_FAILED',
        message: String(cause),
        cause,
      },
    };
  }
}

export async function loadCurriculumManifest(): Promise<Result<CurriculumManifest, AppError>> {
  const url = getCurriculumManifestUrl();

  if (url === BUNDLED_MOCK_MANIFEST_SCHEME) {
    return { ok: true, value: MOCK_MANIFEST };
  }

  return fetchRemoteManifest(url);
}

export async function canDownloadCurriculumUpdate(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected || state.isInternetReachable === false) {
    return false;
  }

  if (__DEV__) {
    return true;
  }

  return state.type === Network.NetworkStateType.WIFI;
}

async function readFileAsBase64(fileUri: string): Promise<string> {
  if (process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-only file store
    const { getMockFileContents } = require('../../../test-support/file-system-test-state') as {
      getMockFileContents: (uri: string) => string | undefined;
    };
    const contents = getMockFileContents(fileUri);
    if (!contents) {
      throw new Error(`File not found: ${fileUri}`);
    }
    return contents;
  }

  return readAsStringAsync(fileUri, { encoding: 'base64' });
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hashes the file's raw bytes (matching the manifest sha256 computed by
 * scripts/compile-curriculum.ts over file contents) and returns a hex digest.
 */
export async function computeFileSha256Hex(fileUri: string): Promise<Result<string, AppError>> {
  try {
    const base64 = await readFileAsBase64(fileUri);
    const digestBuffer = await digest(CryptoDigestAlgorithm.SHA256, base64ToBytes(base64));
    return { ok: true, value: bytesToHex(digestBuffer) };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'CURRICULUM_CHECKSUM_ERROR',
        message: String(cause),
        cause,
      },
    };
  }
}

async function ensureSqliteDirectory(): Promise<Result<void, AppError>> {
  try {
    const dir = getSqliteDirectoryUri();
    const info = await getInfoAsync(dir);
    if (!info.exists) {
      await makeDirectoryAsync(dir, { intermediates: true });
    }
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'CURRICULUM_FS_ERROR',
        message: String(cause),
        cause,
      },
    };
  }
}

async function deleteTempDownloadIfExists(): Promise<void> {
  const tempUri = getCurriculumDownloadUri();
  const info = await getInfoAsync(tempUri);
  if (info.exists) {
    await deleteAsync(tempUri, { idempotent: true });
  }
}

const CURRICULUM_BACKUP_SUFFIX = '.bak';

/**
 * Replaces curriculum.db with the validated temp file.
 * Backs up the current file before swap so a failed move can restore the prior DB (NFR12).
 */
async function atomicReplaceCurriculumFile(
  tempUri: string,
  finalUri: string,
): Promise<Result<void, AppError>> {
  if (process.env.NODE_ENV === 'test') {
    const { applyMockCurriculumSwap } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-only atomic swap
      require('../../../test-support/file-system-test-state') as {
        applyMockCurriculumSwap: (downloadUri: string, finalUri: string) => void;
      };
    applyMockCurriculumSwap(tempUri, finalUri);
    return { ok: true, value: undefined };
  }

  const backupUri = `${finalUri}${CURRICULUM_BACKUP_SUFFIX}`;

  try {
    await deleteAsync(backupUri, { idempotent: true });

    const finalInfo = await getInfoAsync(finalUri);
    if (finalInfo.exists) {
      await moveAsync({ from: finalUri, to: backupUri });
    }

    await moveAsync({ from: tempUri, to: finalUri });
    await deleteAsync(backupUri, { idempotent: true });
    return { ok: true, value: undefined };
  } catch (cause) {
    try {
      const finalInfo = await getInfoAsync(finalUri);
      const backupInfo = await getInfoAsync(backupUri);
      if (!finalInfo.exists && backupInfo.exists) {
        await moveAsync({ from: backupUri, to: finalUri });
      }
    } catch {
      // Best-effort restore; original error is returned below.
    }

    return {
      ok: false,
      error: {
        code: 'CURRICULUM_SWAP_FAILED',
        message: String(cause),
        cause,
      },
    };
  }
}

async function downloadManifestDatabase(manifest: CurriculumManifest): Promise<Result<string, AppError>> {
  const dirResult = await ensureSqliteDirectory();
  if (!dirResult.ok) {
    return dirResult;
  }

  await deleteTempDownloadIfExists();
  const tempUri = getCurriculumDownloadUri();

  try {
    if (manifest.url.startsWith(BUNDLED_FIXTURE_SCHEME)) {
      const fixtureKey = manifest.url.slice(BUNDLED_FIXTURE_SCHEME.length);
      if (fixtureKey === 'curriculum-mock-update') {
        if (process.env.NODE_ENV === 'test') {
          const { getMockCurriculumFixtureBase64, setMockFileContents } =
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-only fixture seed
            require('../../../test-support/file-system-test-state') as {
              getMockCurriculumFixtureBase64: () => string | undefined;
              setMockFileContents: (uri: string, base64Contents: string) => void;
            };
          const fixtureBase64 = getMockCurriculumFixtureBase64();
          if (!fixtureBase64) {
            return {
              ok: false,
              error: {
                code: 'CURRICULUM_DOWNLOAD_FAILED',
                message: 'Mock curriculum fixture was not seeded for tests',
              },
            };
          }
          setMockFileContents(tempUri, fixtureBase64);
          return { ok: true, value: tempUri };
        }

        const asset = Asset.fromModule(MOCK_UPDATE_DB);
        await asset.downloadAsync();
        if (!asset.localUri) {
          return {
            ok: false,
            error: {
              code: 'CURRICULUM_DOWNLOAD_FAILED',
              message: 'Bundled fixture asset has no local URI',
            },
          };
        }
        await copyAsync({ from: asset.localUri, to: tempUri });
        return { ok: true, value: tempUri };
      }

      return {
        ok: false,
        error: {
          code: 'CURRICULUM_DOWNLOAD_FAILED',
          message: `Unknown bundled fixture: ${fixtureKey}`,
        },
      };
    }

    const downloadResult = await downloadAsync(manifest.url, tempUri);
    return { ok: true, value: downloadResult.uri };
  } catch (cause) {
    await deleteTempDownloadIfExists();
    return {
      ok: false,
      error: {
        code: 'CURRICULUM_DOWNLOAD_FAILED',
        message: String(cause),
        cause,
      },
    };
  }
}

export async function validateDownloadedCurriculumFile(
  fileUri: string,
  expectedSha256: string,
): Promise<Result<{ version: string }, AppError>> {
  const checksumResult = await computeFileSha256Hex(fileUri);
  if (!checksumResult.ok) {
    return checksumResult;
  }

  if (checksumResult.value !== expectedSha256.toLowerCase()) {
    return {
      ok: false,
      error: {
        code: 'CURRICULUM_CHECKSUM_MISMATCH',
        message: 'Downloaded curriculum checksum does not match manifest',
      },
    };
  }

  let probeDb: SQLiteDatabase | null = null;
  try {
    probeDb = await openDatabaseAsync(CURRICULUM_DOWNLOAD_NAME);
    const metadata = probeDb.getFirstSync<{ version: string }>(
      'SELECT version FROM curriculum_metadata LIMIT 1',
    );
    if (!metadata?.version) {
      return {
        ok: false,
        error: {
          code: 'CURRICULUM_SQLITE_INVALID',
          message: 'Downloaded file is missing curriculum_metadata.version',
        },
      };
    }

    return { ok: true, value: { version: metadata.version } };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'CURRICULUM_SQLITE_INVALID',
        message: String(cause),
        cause,
      },
    };
  } finally {
    if (probeDb) {
      await probeDb.closeAsync();
    }
  }
}

export async function checkForCurriculumUpdate(
  localVersion: string,
): Promise<Result<CurriculumManifest | null, AppError>> {
  const manifestResult = await loadCurriculumManifest();
  if (!manifestResult.ok) {
    if (__DEV__) {
      console.log('[curriculumUpdate] manifest unreachable:', manifestResult.error.message);
    }
    return { ok: true, value: null };
  }

  const manifest = manifestResult.value;
  if (!isCurriculumVersionNewer(manifest.version, localVersion)) {
    return { ok: true, value: null };
  }

  return { ok: true, value: manifest };
}

export async function downloadAndSwapCurriculum(
  manifest: CurriculumManifest,
  handles: {
    curriculumDb: SQLiteDatabase;
    userDb: SQLiteDatabase;
  },
): Promise<Result<{ version: string; curriculumDb: SQLiteDatabase }, AppError>> {
  const canDownload = await canDownloadCurriculumUpdate();
  if (!canDownload) {
    return {
      ok: false,
      error: {
        code: 'CURRICULUM_DOWNLOAD_DEFERRED',
        message: 'Curriculum download deferred (network or Wi-Fi policy)',
      },
    };
  }

  const downloadResult = await downloadManifestDatabase(manifest);
  if (!downloadResult.ok) {
    return downloadResult;
  }

  const validateResult = await validateDownloadedCurriculumFile(
    downloadResult.value,
    manifest.sha256,
  );
  if (!validateResult.ok) {
    await deleteTempDownloadIfExists();
    return validateResult;
  }

  let curriculumClosedForSwap = false;
  let swapHandedOffDb = false;

  try {
    await handles.curriculumDb.closeAsync();
    curriculumClosedForSwap = true;

    const swapResult = await atomicReplaceCurriculumFile(
      downloadResult.value,
      getCurriculumDbUri(),
    );
    if (!swapResult.ok) {
      await deleteTempDownloadIfExists();
      return swapResult;
    }

    const reopenResult = await reopenCurriculumDatabase();
    if (!reopenResult.ok) {
      return reopenResult;
    }
    attachCurriculumForQuery(handles.userDb, reopenResult.value);

    setCurriculumInstallMetadata(handles.userDb, {
      version: validateResult.value.version,
      source: 'downloaded',
      contentHash: manifest.sha256,
    });

    swapHandedOffDb = true;

    if (__DEV__) {
      console.log(
        '[curriculumUpdate] swap complete:',
        validateResult.value.version,
        'preference',
        handles.userDb.getFirstSync<{ value: string }>(
          'SELECT value FROM user_preferences WHERE key = ?',
          PREFERENCE_KEYS.curriculumUpdateSource,
        )?.value,
      );
    }

    return {
      ok: true,
      value: { version: validateResult.value.version, curriculumDb: reopenResult.value },
    };
  } catch (cause) {
    await deleteTempDownloadIfExists();
    return {
      ok: false,
      error: {
        code: 'CURRICULUM_SWAP_FAILED',
        message: String(cause),
        cause,
      },
    };
  } finally {
    if (curriculumClosedForSwap && !swapHandedOffDb) {
      await reopenCurriculumDatabase();
    }
  }
}

export type CheckAndApplyCurriculumUpdateResult =
  | { status: 'skipped' }
  | { status: 'up_to_date' }
  | { status: 'deferred' }
  | { status: 'success'; version: string; curriculumDb: SQLiteDatabase }
  | { status: 'error'; error: AppError; curriculumDb?: SQLiteDatabase };

export async function checkAndApplyCurriculumUpdate(handles: {
  curriculumDb: SQLiteDatabase;
  userDb: SQLiteDatabase;
}): Promise<CheckAndApplyCurriculumUpdateResult> {
  const localMetadata = handles.curriculumDb.getFirstSync<{ version: string }>(
    'SELECT version FROM curriculum_metadata LIMIT 1',
  );
  const localVersion = localMetadata?.version;
  if (!localVersion) {
    return {
      status: 'error',
      error: {
        code: 'CURRICULUM_VERSION_MISSING',
        message: 'Active curriculum database has no version metadata',
      },
    };
  }

  const checkResult = await checkForCurriculumUpdate(localVersion);
  if (!checkResult.ok) {
    if (__DEV__) {
      console.log('[curriculumUpdate] check failed:', checkResult.error.message);
    }
    return { status: 'skipped' };
  }

  if (!checkResult.value) {
    return { status: 'up_to_date' };
  }

  const canDownload = await canDownloadCurriculumUpdate();
  if (!canDownload) {
    if (__DEV__) {
      console.log('[curriculumUpdate] update deferred (network policy)');
    }
    return { status: 'deferred' };
  }

  const swapResult = await downloadAndSwapCurriculum(checkResult.value, handles);
  if (!swapResult.ok) {
    if (__DEV__) {
      console.log('[curriculumUpdate] swap failed:', swapResult.error.message);
    }
    if (swapResult.error.code === 'CURRICULUM_DOWNLOAD_DEFERRED') {
      return { status: 'deferred' };
    }

    const reopenResult = await reopenCurriculumDatabase();
    return {
      status: 'error',
      error: swapResult.error,
      curriculumDb: reopenResult.ok ? reopenResult.value : undefined,
    };
  }

  return {
    status: 'success',
    version: swapResult.value.version,
    curriculumDb: swapResult.value.curriculumDb,
  };
}
