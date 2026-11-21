import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import * as Network from 'expo-network';
import {
  backupDatabaseAsync,
  deserializeDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { SIGNING_KEYS, verifySignedManifest } from '@/core/curriculum/manifestSignature';
import {
  CURRICULUM_DB_NAME,
  getCurriculumFileUrl,
  getCurriculumManifestUrl,
  REQUIRED_CURRICULUM_SCHEMA_VERSION,
} from '@/data/curriculum/curriculumConfig';
import type { CheckAndApplyCurriculumUpdateResult } from '@/data/curriculum/curriculumManifest.types';
import {
  isCurriculumSwapHeld,
  waitForCurriculumSwapAllowed,
} from '@/data/curriculum/curriculumSwapGate';
import { isCurriculumVersionNewer } from '@/data/curriculum/curriculumVersion';
import {
  CURRICULUM_ATTACH_ALIAS,
  attachCurriculumForQuery,
  reopenCurriculumDatabase,
} from '@/data/database';
import { setCurriculumInstallMetadata } from '@/data/user/preferencesRepository';
import type { AppError, Result } from '@/types/result.types';

/** Everything the web update touches outside the two database handles. */
export type WebCurriculumPorts = {
  fetchJson(url: string): Promise<Result<unknown, AppError>>;
  fetchBytes(url: string): Promise<Result<Uint8Array, AppError>>;
  isOnline(): Promise<boolean>;
  sha256Hex(bytes: Uint8Array): Promise<string>;
  openMemoryDb(bytes: Uint8Array): Promise<SQLiteDatabase>;
  openCurriculumFile(): Promise<SQLiteDatabase>;
  backup(source: SQLiteDatabase, dest: SQLiteDatabase): Promise<void>;
  waitForSwapAllowed(): Promise<void>;
  isSwapHeld(): boolean;
  delay(ms: number): Promise<void>;
};

/** How long an attach waits for a sync transaction on user.db to end. */
const USER_DB_POLL_MS = 200;
const USER_DB_MAX_WAIT_MS = 10_000;

type Handles = { curriculumDb: SQLiteDatabase; userDb: SQLiteDatabase };

async function fetchWithOmittedCredentials(
  url: string,
  failureCode: string,
  read: (response: Response) => Promise<unknown>,
): Promise<Result<unknown, AppError>> {
  try {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) {
      return {
        ok: false,
        error: { code: failureCode, message: `Request failed with status ${response.status}` },
      };
    }
    return { ok: true, value: await read(response) };
  } catch (cause) {
    return { ok: false, error: { code: failureCode, message: String(cause), cause } };
  }
}

export const defaultWebPorts: WebCurriculumPorts = {
  fetchJson: (url) =>
    fetchWithOmittedCredentials(url, 'CURRICULUM_MANIFEST_FETCH_FAILED', (response) =>
      response.json(),
    ),
  fetchBytes: (url) =>
    fetchWithOmittedCredentials(
      url,
      'CURRICULUM_DOWNLOAD_FAILED',
      async (response) => new Uint8Array(await response.arrayBuffer()),
    ) as Promise<Result<Uint8Array, AppError>>,
  isOnline: async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      return Boolean(state.isConnected) && state.isInternetReachable !== false;
    } catch {
      return false;
    }
  },
  sha256Hex: async (bytes) => {
    const buffer = await digest(CryptoDigestAlgorithm.SHA256, bytes as Uint8Array<ArrayBuffer>);
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  },
  openMemoryDb: (bytes) => deserializeDatabaseAsync(bytes),
  openCurriculumFile: () => openDatabaseAsync(CURRICULUM_DB_NAME),
  backup: (sourceDatabase, destDatabase) => backupDatabaseAsync({ sourceDatabase, destDatabase }),
  waitForSwapAllowed: waitForCurriculumSwapAllowed,
  isSwapHeld: isCurriculumSwapHeld,
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function errorResult(
  code: string,
  cause: unknown,
  curriculumDb?: SQLiteDatabase,
): CheckAndApplyCurriculumUpdateResult {
  return {
    status: 'error',
    error: { code, message: cause instanceof Error ? cause.message : String(cause), cause },
    ...(curriculumDb ? { curriculumDb } : {}),
  };
}

async function closeQuietly(db: SQLiteDatabase | null): Promise<void> {
  if (!db) {
    return;
  }
  try {
    await db.closeAsync();
  } catch {
    // The caller is already returning a result; nothing more to undo.
  }
}

/** Waits until user.db is outside a transaction; false when the bounded wait ends first. */
async function waitForUserDbFree(
  ports: WebCurriculumPorts,
  userDb: SQLiteDatabase,
): Promise<boolean> {
  for (let waited = 0; ; waited += USER_DB_POLL_MS) {
    if (!(await userDb.isInTransactionAsync())) {
      return true;
    }
    if (waited >= USER_DB_MAX_WAIT_MS) {
      return false;
    }
    await ports.delay(USER_DB_POLL_MS);
  }
}

type AttachOutcome = { status: 'attached' } | { status: 'busy' } | { status: 'failed'; cause: unknown };

/** SQLite refuses ATTACH inside a transaction, so wait for a sync on user.db first. */
async function attachWhenUserDbFree(
  ports: WebCurriculumPorts,
  userDb: SQLiteDatabase,
  curriculumDb: SQLiteDatabase,
): Promise<AttachOutcome> {
  try {
    if (!(await waitForUserDbFree(ports, userDb))) {
      return { status: 'busy' };
    }
    attachCurriculumForQuery(userDb, curriculumDb);
    return { status: 'attached' };
  } catch (cause) {
    return { status: 'failed', cause };
  }
}

/**
 * Opens the on-disk curriculum again and attaches it to user.db. An attach that throws is
 * tried once more after another wait. The handle is returned either way; the caller
 * reports the error.
 */
async function recoverCurriculum(
  ports: WebCurriculumPorts,
  userDb: SQLiteDatabase,
): Promise<SQLiteDatabase | undefined> {
  const reopened = await reopenCurriculumDatabase();
  if (!reopened.ok) {
    return undefined;
  }
  const first = await attachWhenUserDbFree(ports, userDb, reopened.value);
  if (first.status === 'failed') {
    await attachWhenUserDbFree(ports, userDb, reopened.value);
  }
  return reopened.value;
}

/** Version and integrity of a downloaded copy, read while it is still in memory. */
async function probeMemoryDb(mem: SQLiteDatabase, signedVersion: number): Promise<boolean> {
  const metadata = await mem.getFirstAsync<{ version: string }>(
    'SELECT version FROM curriculum_metadata LIMIT 1',
  );
  if (metadata?.version !== String(signedVersion)) {
    return false;
  }
  const check = await mem.getFirstAsync<{ quick_check: string }>('PRAGMA quick_check');
  return check?.quick_check === 'ok';
}

export async function runWebCurriculumUpdate(
  ports: WebCurriculumPorts,
  handles: Handles,
): Promise<CheckAndApplyCurriculumUpdateResult> {
  const { curriculumDb, userDb } = handles;

  // 1. Local version.
  let localVersion: string | undefined;
  try {
    localVersion = (
      await curriculumDb.getFirstAsync<{ version: string }>(
        'SELECT version FROM curriculum_metadata LIMIT 1',
      )
    )?.version;
  } catch (cause) {
    return errorResult('CURRICULUM_VERSION_MISSING', cause);
  }
  if (!localVersion) {
    return errorResult(
      'CURRICULUM_VERSION_MISSING',
      'Active curriculum database has no version metadata',
    );
  }

  // 2. Signed manifest. A rejected manifest never leads to a file request.
  const manifest = await ports.fetchJson(getCurriculumManifestUrl());
  if (!manifest.ok) {
    return { status: 'skipped' };
  }
  const verified = verifySignedManifest(
    manifest.value,
    SIGNING_KEYS,
    REQUIRED_CURRICULUM_SCHEMA_VERSION,
  );
  if (!verified.ok) {
    return { status: 'skipped' };
  }
  const release = verified.value;
  if (!isCurriculumVersionNewer(release.version, localVersion)) {
    return { status: 'up_to_date' };
  }

  // 3. Network.
  if (!(await ports.isOnline())) {
    return { status: 'deferred' };
  }

  // 4. File and checksum. Nothing is open yet, so nothing needs closing.
  const file = await ports.fetchBytes(getCurriculumFileUrl(release.sha256));
  if (!file.ok) {
    return { status: 'error', error: file.error };
  }
  let digestHex: string;
  try {
    digestHex = await ports.sha256Hex(file.value);
  } catch (cause) {
    return errorResult('CURRICULUM_CHECKSUM_ERROR', cause);
  }
  if (digestHex !== release.sha256) {
    return errorResult(
      'CURRICULUM_CHECKSUM_MISMATCH',
      'Downloaded curriculum checksum does not match manifest',
    );
  }

  // 5. Probe the copy in memory.
  let mem: SQLiteDatabase;
  try {
    mem = await ports.openMemoryDb(file.value);
  } catch (cause) {
    return errorResult('CURRICULUM_SQLITE_INVALID', cause);
  }
  try {
    if (!(await probeMemoryDb(mem, release.version))) {
      await closeQuietly(mem);
      return errorResult(
        'CURRICULUM_SQLITE_INVALID',
        'Downloaded curriculum failed the version or integrity check',
      );
    }
  } catch (cause) {
    await closeQuietly(mem);
    return errorResult('CURRICULUM_SQLITE_INVALID', cause);
  }

  // 6. The gate can be held again while the transaction probe awaits, so check it
  // last, with nothing awaited between the check and closing the curriculum.
  for (;;) {
    await ports.waitForSwapAllowed();

    let userDbBusy: boolean;
    try {
      userDbBusy = await userDb.isInTransactionAsync();
    } catch (cause) {
      await closeQuietly(mem);
      return errorResult('CURRICULUM_SWAP_FAILED', cause);
    }

    // A user.db write in flight must finish first; try again on the next launch.
    if (userDbBusy) {
      await closeQuietly(mem);
      return { status: 'deferred' };
    }

    if (!ports.isSwapHeld()) {
      break;
    }
  }

  // 7. Copy the verified bytes over curriculum.db.
  let dest: SQLiteDatabase | null = null;
  try {
    await curriculumDb.closeAsync();
    await userDb.execAsync(`DETACH DATABASE ${CURRICULUM_ATTACH_ALIAS}`);
    dest = await ports.openCurriculumFile();
    await ports.backup(mem, dest);
    await dest.closeAsync();
    dest = null;
  } catch (cause) {
    await closeQuietly(dest);
    await closeQuietly(mem);
    const recovered = (await recoverCurriculum(ports, userDb)) ?? (await recoverCurriculum(ports, userDb));
    return errorResult('CURRICULUM_SWAP_FAILED', cause, recovered);
  }

  // 8. Open the new file, attach it, record the install.
  await closeQuietly(mem);
  const reopened = await reopenCurriculumDatabase();
  if (!reopened.ok) {
    // The file is the new release but no handle is open; try once more so the app keeps a curriculum.
    return {
      status: 'error',
      error: reopened.error,
      curriculumDb: await recoverCurriculum(ports, userDb),
    };
  }
  const attached = await attachWhenUserDbFree(ports, userDb, reopened.value);
  if (attached.status === 'busy') {
    // A sync kept user.db in a transaction for the whole wait. The handle is valid but
    // not attached; the error is the only signal. No metadata write, no banner.
    return errorResult(
      'CURRICULUM_SWAP_FAILED',
      'user.db stayed in a transaction while the curriculum was attached',
      reopened.value,
    );
  }
  if (attached.status === 'failed') {
    // user.db may be detached: open and attach again. No metadata write, no banner.
    await closeQuietly(reopened.value);
    return errorResult(
      'CURRICULUM_SWAP_FAILED',
      attached.cause,
      await recoverCurriculum(ports, userDb),
    );
  }
  try {
    setCurriculumInstallMetadata(userDb, {
      version: String(release.version),
      source: 'downloaded',
      contentHash: release.sha256,
    });
  } catch (cause) {
    return errorResult('CURRICULUM_SWAP_FAILED', cause, reopened.value);
  }

  return { status: 'success', version: String(release.version), curriculumDb: reopened.value };
}

export async function checkAndApplyCurriculumUpdate(
  handles: Handles,
): Promise<CheckAndApplyCurriculumUpdateResult> {
  return runWebCurriculumUpdate(defaultWebPorts, handles);
}
