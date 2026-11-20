import { sign, type KeyObject } from 'node:crypto';

import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getCurriculumFileUrl,
  getCurriculumManifestUrl,
} from '@/data/curriculum/curriculumConfig';
import {
  defaultWebPorts,
  runWebCurriculumUpdate,
  type WebCurriculumPorts,
} from '@/data/curriculum/curriculumUpdate.web';
import {
  holdCurriculumSwap,
  isCurriculumSwapHeld,
  resetCurriculumSwapGateForTests,
  waitForCurriculumSwapAllowed,
} from '@/data/curriculum/curriculumSwapGate';

const mockCalls: string[] = [];
const mockReopen = jest.fn();
const mockAttach = jest.fn();
const mockSetMetadata = jest.fn();

jest.mock('@/data/database', () => ({
  reopenCurriculumDatabase: () => mockReopen(),
  attachCurriculumForQuery: (...args: unknown[]) => mockAttach(...args),
}));

jest.mock('@/data/user/preferencesRepository', () => ({
  setCurriculumInstallMetadata: (...args: unknown[]) => mockSetMetadata(...args),
}));

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

const SHA = 'a'.repeat(64);
const BYTES = new Uint8Array([1, 2, 3]);

function signedManifest(version: number, sha256: string = SHA, schema = 1) {
  const payload = Buffer.from(
    JSON.stringify({
      schema,
      version,
      sha256,
      size_bytes: 3,
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

type FakeDb = {
  name: string;
  getFirstAsync: jest.Mock;
  closeAsync: jest.Mock;
  execAsync: jest.Mock;
  isInTransactionAsync: jest.Mock;
};

function fakeDb(name: string, version: string | null): FakeDb {
  return {
    name,
    getFirstAsync: jest.fn(async (sql: string) => {
      if (/quick_check/i.test(sql)) {
        return { quick_check: 'ok' };
      }
      return version === null ? null : { version };
    }),
    closeAsync: jest.fn(async () => {
      mockCalls.push(`close ${name}`);
    }),
    execAsync: jest.fn(async (sql: string) => {
      mockCalls.push(sql.startsWith('DETACH') ? 'DETACH' : sql);
    }),
    isInTransactionAsync: jest.fn(async () => false),
  };
}

function asDb(db: FakeDb): SQLiteDatabase {
  return db as unknown as SQLiteDatabase;
}

type Harness = {
  ports: WebCurriculumPorts;
  curriculumDb: FakeDb;
  userDb: FakeDb;
  mem: FakeDb;
  dest: FakeDb;
  reopened: FakeDb;
  fetchJson: jest.MockedFunction<WebCurriculumPorts['fetchJson']>;
  fetchBytes: jest.MockedFunction<WebCurriculumPorts['fetchBytes']>;
  backup: jest.Mock;
};

function harness(
  options: {
    manifest?: unknown;
    localVersion?: string | null;
    memVersion?: string;
    online?: boolean;
    hash?: string;
  } = {},
): Harness {
  const curriculumDb = fakeDb('curriculum', options.localVersion === undefined ? '1' : options.localVersion);
  const userDb = fakeDb('user', null);
  const mem = fakeDb('mem', options.memVersion ?? '2');
  const dest = fakeDb('dest', null);
  const reopened = fakeDb('reopened', '2');
  mockReopen.mockImplementation(async () => {
    mockCalls.push('reopen');
    return { ok: true, value: reopened };
  });
  mockAttach.mockImplementation(() => {
    mockCalls.push('attach');
  });
  mockSetMetadata.mockImplementation(() => {
    mockCalls.push('metadata');
  });

  const fetchJson = jest.fn<ReturnType<WebCurriculumPorts['fetchJson']>, [string]>(async () => {
    mockCalls.push('fetchJson');
    return { ok: true, value: options.manifest ?? signedManifest(2) };
  });
  const fetchBytes = jest.fn<ReturnType<WebCurriculumPorts['fetchBytes']>, [string]>(async () => {
    mockCalls.push('fetchBytes');
    return { ok: true, value: BYTES };
  });
  const backup = jest.fn(async () => {
    mockCalls.push('backup');
  });
  const ports: WebCurriculumPorts = {
    fetchJson,
    fetchBytes,
    isOnline: jest.fn(async () => options.online ?? true),
    sha256Hex: jest.fn(async () => {
      mockCalls.push('sha256Hex');
      return options.hash ?? SHA;
    }),
    openMemoryDb: jest.fn(async () => {
      mockCalls.push('openMemoryDb');
      return asDb(mem);
    }),
    openCurriculumFile: jest.fn(async () => {
      mockCalls.push('openCurriculumFile');
      return asDb(dest);
    }),
    backup,
    waitForSwapAllowed: jest.fn(async () => {
      mockCalls.push('waitForSwapAllowed');
    }),
    isSwapHeld: jest.fn(() => false),
  };
  return { ports, curriculumDb, userDb, mem, dest, reopened, fetchJson, fetchBytes, backup };
}

function run(h: Harness) {
  return runWebCurriculumUpdate(h.ports, {
    curriculumDb: asDb(h.curriculumDb),
    userDb: asDb(h.userDb),
  });
}

describe('runWebCurriculumUpdate', () => {
  beforeEach(() => {
    mockCalls.length = 0;
    jest.clearAllMocks();
    resetCurriculumSwapGateForTests();
  });

  it('installs a newer signed release', async () => {
    const h = harness();

    const result = await run(h);

    expect(result).toEqual({ status: 'success', version: '2', curriculumDb: h.reopened });
    expect(mockCalls).toEqual([
      'fetchJson',
      'fetchBytes',
      'sha256Hex',
      'openMemoryDb',
      'waitForSwapAllowed',
      'close curriculum',
      'DETACH',
      'openCurriculumFile',
      'backup',
      'close dest',
      'close mem',
      'reopen',
      'attach',
      'metadata',
    ]);
    expect(h.fetchJson).toHaveBeenCalledWith(getCurriculumManifestUrl());
    expect(h.fetchBytes).toHaveBeenCalledWith(getCurriculumFileUrl(SHA));
    expect(h.backup).toHaveBeenCalledWith(asDb(h.mem), asDb(h.dest));
    expect(mockAttach).toHaveBeenCalledWith(asDb(h.userDb), h.reopened);
    expect(mockSetMetadata).toHaveBeenCalledWith(asDb(h.userDb), {
      version: '2',
      source: 'downloaded',
      contentHash: SHA,
    });
  });

  it('reports a missing local version as an error', async () => {
    const h = harness({ localVersion: null });

    const result = await run(h);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toBe('CURRICULUM_VERSION_MISSING');
    }
    expect(h.fetchJson).not.toHaveBeenCalled();
  });

  it('a rejected manifest makes no file request', async () => {
    const tampered = signedManifest(2);
    tampered.payload = Buffer.from(
      JSON.stringify({ schema: 1, version: 9, sha256: SHA, size_bytes: 3, published_at: 'x' }),
    ).toString('base64');
    const h = harness({ manifest: tampered });

    expect(await run(h)).toEqual({ status: 'skipped' });
    expect(h.fetchBytes).not.toHaveBeenCalled();
  });

  it('an unsigned manifest makes no file request', async () => {
    const h = harness({ manifest: { version: 2, sha256: SHA } });

    expect(await run(h)).toEqual({ status: 'skipped' });
    expect(h.fetchBytes).not.toHaveBeenCalled();
  });

  it('a failed manifest fetch is skipped', async () => {
    const h = harness();
    h.fetchJson.mockResolvedValueOnce({
      ok: false,
      error: { code: 'CURRICULUM_MANIFEST_FETCH_FAILED', message: 'x' },
    });

    expect(await run(h)).toEqual({ status: 'skipped' });
    expect(h.fetchBytes).not.toHaveBeenCalled();
  });

  it('not newer gives up_to_date and no file request', async () => {
    const h = harness({ localVersion: '2' });

    expect(await run(h)).toEqual({ status: 'up_to_date' });
    expect(h.fetchBytes).not.toHaveBeenCalled();
  });

  it('offline gives deferred and no file request', async () => {
    const h = harness({ online: false });

    expect(await run(h)).toEqual({ status: 'deferred' });
    expect(h.fetchBytes).not.toHaveBeenCalled();
  });

  it('a failed file fetch changes nothing', async () => {
    const h = harness();
    h.fetchBytes.mockResolvedValueOnce({
      ok: false,
      error: { code: 'CURRICULUM_DOWNLOAD_FAILED', message: 'x' },
    });

    const result = await run(h);

    expect(result).toEqual({
      status: 'error',
      error: { code: 'CURRICULUM_DOWNLOAD_FAILED', message: 'x' },
    });
    expect(h.curriculumDb.closeAsync).not.toHaveBeenCalled();
    expect(h.backup).not.toHaveBeenCalled();
  });

  it('a hash mismatch changes nothing and closes nothing', async () => {
    const h = harness({ hash: 'b'.repeat(64) });

    const result = await run(h);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toBe('CURRICULUM_CHECKSUM_MISMATCH');
      expect(result.curriculumDb).toBeUndefined();
    }
    expect(h.ports.openMemoryDb).not.toHaveBeenCalled();
    expect(h.curriculumDb.closeAsync).not.toHaveBeenCalled();
    expect(h.backup).not.toHaveBeenCalled();
  });

  it('a probe version that differs from the signed version is invalid', async () => {
    const h = harness({ memVersion: '3' });

    const result = await run(h);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toBe('CURRICULUM_SQLITE_INVALID');
      expect(result.curriculumDb).toBeUndefined();
    }
    expect(h.mem.closeAsync).toHaveBeenCalledTimes(1);
    expect(h.curriculumDb.closeAsync).not.toHaveBeenCalled();
    expect(h.backup).not.toHaveBeenCalled();
  });

  it('a failed quick_check is invalid', async () => {
    const h = harness();
    h.mem.getFirstAsync.mockImplementation(async (sql: string) =>
      /quick_check/i.test(sql) ? { quick_check: '*** in database main ***' } : { version: '2' },
    );

    const result = await run(h);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toBe('CURRICULUM_SQLITE_INVALID');
    }
    expect(h.mem.closeAsync).toHaveBeenCalledTimes(1);
    expect(h.curriculumDb.closeAsync).not.toHaveBeenCalled();
  });

  it('waits for the swap gate', async () => {
    const h = harness();
    const release = holdCurriculumSwap();
    h.ports.waitForSwapAllowed = waitForCurriculumSwapAllowed;
    h.ports.isSwapHeld = isCurriculumSwapHeld;

    const pending = run(h);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(h.curriculumDb.closeAsync).not.toHaveBeenCalled();

    release();
    expect((await pending).status).toBe('success');
    expect(h.curriculumDb.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('waits again when the gate is held during the transaction probe', async () => {
    const h = harness();
    let release: (() => void) | undefined;
    h.ports.waitForSwapAllowed = waitForCurriculumSwapAllowed;
    h.ports.isSwapHeld = isCurriculumSwapHeld;
    h.userDb.isInTransactionAsync.mockImplementationOnce(async () => {
      release = holdCurriculumSwap();
      return false;
    });

    const pending = run(h);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(h.curriculumDb.closeAsync).not.toHaveBeenCalled();
    expect(h.userDb.isInTransactionAsync).toHaveBeenCalledTimes(1);

    release?.();
    expect((await pending).status).toBe('success');
    expect(h.userDb.isInTransactionAsync).toHaveBeenCalledTimes(2);
    expect(h.curriculumDb.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('user.db in a transaction defers the swap', async () => {
    const h = harness();
    h.userDb.isInTransactionAsync.mockResolvedValue(true);

    expect(await run(h)).toEqual({ status: 'deferred' });
    expect(h.curriculumDb.closeAsync).not.toHaveBeenCalled();
    expect(h.mem.closeAsync).toHaveBeenCalledTimes(1);
    expect(h.backup).not.toHaveBeenCalled();
  });

  it('a rejecting transaction probe returns an error and closes only the memory db', async () => {
    const h = harness();
    h.userDb.isInTransactionAsync.mockRejectedValue(new Error('probe failed'));

    const result = await run(h);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.curriculumDb).toBeUndefined();
    }
    expect(h.mem.closeAsync).toHaveBeenCalledTimes(1);
    expect(h.curriculumDb.closeAsync).not.toHaveBeenCalled();
    expect(h.userDb.closeAsync).not.toHaveBeenCalled();
    expect(h.backup).not.toHaveBeenCalled();
  });

  it('a failed copy reopens and attaches the old curriculum', async () => {
    const h = harness();
    h.backup.mockRejectedValue(new Error('copy failed'));

    const result = await run(h);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.curriculumDb).toBe(h.reopened);
    }
    expect(mockAttach).toHaveBeenCalledWith(asDb(h.userDb), h.reopened);
    expect(mockSetMetadata).not.toHaveBeenCalled();
    expect(h.mem.closeAsync).toHaveBeenCalledTimes(1);
    expect(h.dest.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('a failed reopen after a failed copy returns an error without a handle', async () => {
    const h = harness();
    h.backup.mockRejectedValue(new Error('copy failed'));
    mockReopen.mockResolvedValue({ ok: false, error: { code: 'DB_CURRICULUM_REOPEN_ERROR', message: 'x' } });

    const result = await run(h);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.curriculumDb).toBeUndefined();
    }
    expect(mockSetMetadata).not.toHaveBeenCalled();
  });
});

describe('defaultWebPorts', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches with credentials omit', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ a: 1 }),
      arrayBuffer: async () => new Uint8Array([7, 8]).buffer,
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const json = await defaultWebPorts.fetchJson('/m.json');
    const bytes = await defaultWebPorts.fetchBytes('/f.db');

    expect(json).toEqual({ ok: true, value: { a: 1 } });
    expect(bytes).toEqual({ ok: true, value: new Uint8Array([7, 8]) });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/m.json', { credentials: 'omit' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/f.db', { credentials: 'omit' });
  });

  it('maps a non-200 response to a fetch error', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;

    const manifest = await defaultWebPorts.fetchJson('/m.json');
    const file = await defaultWebPorts.fetchBytes('/f.db');

    expect(manifest.ok === false && manifest.error.code).toBe('CURRICULUM_MANIFEST_FETCH_FAILED');
    expect(file.ok === false && file.error.code).toBe('CURRICULUM_DOWNLOAD_FAILED');
  });

  it('maps a rejected fetch to a fetch error', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;

    const file = await defaultWebPorts.fetchBytes('/f.db');

    expect(file.ok === false && file.error.code).toBe('CURRICULUM_DOWNLOAD_FAILED');
  });
});
