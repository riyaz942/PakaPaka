import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import {
  deleteAsync,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
  moveAsync,
  readAsStringAsync,
} from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { SIGNING_KEYS, verifySignedManifest } from '@/core/curriculum/manifestSignature';
import {
  CURRICULUM_DOWNLOAD_NAME,
  getCurriculumDbUri,
  getCurriculumDownloadUri,
  getCurriculumFileUrl,
  getCurriculumManifestUrl,
  getSqliteDirectoryUri,
  REQUIRED_CURRICULUM_SCHEMA_VERSION,
} from '@/data/curriculum/curriculumConfig';
import type {
  CheckAndApplyCurriculumUpdateResult,
  CurriculumRelease,
} from '@/data/curriculum/curriculumManifest.types';
import {
  isCurriculumSwapHeld,
  waitForCurriculumSwapAllowed,
} from '@/data/curriculum/curriculumSwapGate';
import { isCurriculumVersionNewer } from '@/data/curriculum/curriculumVersion';
import { attachCurriculumForQuery, reopenCurriculumDatabase } from '@/data/database';
import {
  PREFERENCE_KEYS,
  setCurriculumInstallMetadata,
} from '@/data/user/preferencesRepository';
import { curriculumDownloadNeedsWifi } from '@/platform/capabilities';
import type { AppError, Result } from '@/types/result.types';

async function fetchManifestJson(): Promise<Result<unknown, AppError>> {
  try {
    const response = await fetch(getCurriculumManifestUrl());
    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: 'CURRICULUM_MANIFEST_FETCH_FAILED',
          message: `Manifest fetch failed with status ${response.status}`,
        },
      };
    }

    return { ok: true, value: (await response.json()) as unknown };
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

export async function loadCurriculumManifest(): Promise<Result<CurriculumRelease, AppError>> {
  const jsonResult = await fetchManifestJson();
  if (!jsonResult.ok) {
    return jsonResult;
  }

  return verifySignedManifest(jsonResult.value, SIGNING_KEYS, REQUIRED_CURRICULUM_SCHEMA_VERSION);
}

export async function canDownloadCurriculumUpdate(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected || state.isInternetReachable === false) {
    return false;
  }

  if (curriculumDownloadNeedsWifi()) {
    return state.type === Network.NetworkStateType.WIFI;
  }

  return true;
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

async function downloadReleaseDatabase(release: CurriculumRelease): Promise<Result<string, AppError>> {
  const dirResult = await ensureSqliteDirectory();
  if (!dirResult.ok) {
    return dirResult;
  }

  await deleteTempDownloadIfExists();
  const tempUri = getCurriculumDownloadUri();

  try {
    const downloadResult = await downloadAsync(getCurriculumFileUrl(release.sha256), tempUri);
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
  release: CurriculumRelease,
): Promise<Result<{ version: string }, AppError>> {
  const checksumResult = await computeFileSha256Hex(fileUri);
  if (!checksumResult.ok) {
    return checksumResult;
  }

  if (checksumResult.value !== release.sha256) {
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

    if (metadata.version !== String(release.version)) {
      return {
        ok: false,
        error: {
          code: 'CURRICULUM_SQLITE_INVALID',
          message: 'Downloaded curriculum version does not match the signed version',
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
): Promise<Result<CurriculumRelease | null, AppError>> {
  const manifestResult = await loadCurriculumManifest();
  if (!manifestResult.ok) {
    if (__DEV__) {
      console.log('[curriculumUpdate] manifest not used:', manifestResult.error.code);
    }
    return { ok: true, value: null };
  }

  const release = manifestResult.value;
  if (!isCurriculumVersionNewer(release.version, localVersion)) {
    return { ok: true, value: null };
  }

  return { ok: true, value: release };
}

export async function downloadAndSwapCurriculum(
  release: CurriculumRelease,
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

  const downloadResult = await downloadReleaseDatabase(release);
  if (!downloadResult.ok) {
    return downloadResult;
  }

  const validateResult = await validateDownloadedCurriculumFile(
    downloadResult.value,
    release,
  );
  if (!validateResult.ok) {
    await deleteTempDownloadIfExists();
    return validateResult;
  }

  // The gate can be held again while the transaction probe awaits, so check it
  // last, with nothing awaited between the check and closeAsync.
  for (;;) {
    await waitForCurriculumSwapAllowed();

    let userDbBusy: boolean;
    try {
      userDbBusy = await handles.userDb.isInTransactionAsync();
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
    }

    // A user.db write in flight must finish first; try again on the next launch.
    if (userDbBusy) {
      await deleteTempDownloadIfExists();
      return {
        ok: false,
        error: {
          code: 'CURRICULUM_DOWNLOAD_DEFERRED',
          message: 'Curriculum swap deferred (user database is busy)',
        },
      };
    }

    if (!isCurriculumSwapHeld()) {
      break;
    }
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
      contentHash: release.sha256,
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
