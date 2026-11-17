import type { BackupBundle, BackupData, ItemRef } from '@/core/backup/backup.types';
import { diffSyncData, sameSyncData } from '@/core/sync/diffSyncData';
import {
  SYNC_TABLE_KEYS,
  type CarriedKeys,
  type ConflictChoice,
  type ConflictEntry,
  type KnownContent,
  type SyncTableKey,
} from '@/core/sync/sync.types';
import { syncError } from '@/core/sync/syncMessages';
import { createSyncRunner, type SyncPorts } from '@/core/sync/syncRunner';
import { emptySyncData } from '@/core/sync/syncSamples.testutil';
import { isKnownRow, rowKey } from '@/core/sync/syncTables';
import type { SyncBase } from '@/data/sync/syncBaseStore';
import type { AppError, Result } from '@/types/result.types';

type Row<K extends keyof BackupData> = BackupData[K][number];

const SCHEMA = 22;
const T0 = '2026-11-15T00:00:00.000Z';
const LOCAL_AT = '2026-11-16T08:00:00.000Z';
const REMOTE_AT = '2026-11-16T09:00:00.000Z';
const NOW = '2026-11-17T12:00:00.000Z';

function item(slug: string): ItemRef {
  return { itemType: 'kanji', slug };
}

function mnemonic(slug: string, text: string, updatedAt = T0): Row<'personalMnemonics'> {
  return { item: item(slug), mnemonicText: text, updatedAt };
}

function srs(slug: string, reps: number, updatedAt = T0): Row<'srsStates'> {
  return {
    item: item(slug),
    stability: reps,
    difficulty: 5,
    dueDate: '2026-11-20T00:00:00.000Z',
    fsrsState: 'review',
    reps,
    lapses: 0,
    learningSteps: 0,
    isBurned: false,
    srsStageLabel: 'Apprentice 2',
    lastReviewedAt: null,
    updatedAt,
  };
}

function file(parts: Partial<BackupData>): BackupData {
  return { ...emptySyncData(), ...parts };
}

/** Both devices synced: items 1 and 2 learned. */
function syncedFile(): BackupData {
  return file({
    srsStates: [srs('1', 1), srs('2', 1)],
    personalMnemonics: [mnemonic('1', 'one'), mnemonic('2', 'two')],
  });
}

// Identity-style codec: JSON text as one byte per char (test data is ASCII).
function toBytes(value: unknown): Uint8Array {
  return Uint8Array.from(JSON.stringify(value), (char) => char.charCodeAt(0));
}

function fromBytes(bytes: Uint8Array): unknown {
  return JSON.parse(String.fromCharCode(...bytes));
}

const encode: SyncPorts['encode'] = async (envelope, data) => toBytes({ ...envelope, data });

const decode: SyncPorts['decode'] = async (bytes) => {
  try {
    const parsed = fromBytes(bytes) as { schemaVersion: number; data: BackupData };
    return { ok: true, value: { ...parsed, data: file(parsed.data) } as BackupBundle };
  } catch (cause) {
    return { ok: false, error: syncError('sync_bad_file', cause) };
  }
};

function apiError(code: string): AppError {
  return { code, message: code };
}

type Server = {
  revision: number;
  bytes: Uint8Array | null;
  /** Runs before a push is compared, e.g. another device pushing first. */
  beforePush: (() => void) | null;
  failPush: AppError | null;
};

function serverWith(revision: number, data: BackupData | null, schemaVersion = SCHEMA): Server {
  return {
    revision,
    bytes: data ? toBytes({ schemaVersion, data }) : null,
    beforePush: null,
    failPush: null,
  };
}

function serverFile(server: Server): BackupData {
  return (fromBytes(server.bytes as Uint8Array) as { data: BackupData }).data;
}

/** Another device pushes `data` to the server. */
function otherDevicePushes(server: Server, data: BackupData): void {
  server.revision += 1;
  server.bytes = toBytes({ schemaVersion: SCHEMA, data });
}

type Device = {
  db: BackupData;
  base: SyncBase | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

function harness(options: {
  db: BackupData;
  base?: { revision: number; data: BackupData; pendingReplace?: boolean; carried?: CarriedKeys } | null;
  server: Server;
  unknownSlugs?: string[];
  studyActive?: boolean;
  choice?: ConflictChoice | null;
  signedIn?: boolean;
}) {
  const unknown = new Set(options.unknownSlugs ?? []);
  const known: KnownContent = {
    hasItem: (ref) => !unknown.has(ref.slug),
    hasPassageQuestion: () => true,
  };
  const device: Device = {
    db: options.db,
    base: options.base
      ? {
          revision: options.base.revision,
          data: options.base.data,
          pendingReplace: options.base.pendingReplace ?? false,
          carried: options.base.carried ?? {},
        }
      : null,
    lastSyncedAt: null,
    lastError: null,
  };
  const { server } = options;
  const phases: string[] = [];

  const ports = {
    isSignedIn: jest.fn(async () => options.signedIn ?? true),
    readSnapshot: jest.fn(async () => ({
      ok: true as const,
      value: {
        data: device.db,
        schemaVersion: SCHEMA,
        lookup: { idToRef: new Map(), refToId: new Map(), known, curriculumVersion: '1.0.0' },
      },
    })),
    readBase: jest.fn(async () => ({ ok: true as const, value: device.base })),
    applyMerge: jest.fn(async (args: Parameters<SyncPorts['applyMerge']>[0]) => {
      if (!sameSyncData(device.db, args.expectedLocal)) {
        return { ok: false as const, error: syncError('sync_local_changed') };
      }
      const diff = diffSyncData(args.expectedLocal, args.merged, known);
      const changedRows = SYNC_TABLE_KEYS.reduce(
        (sum, table) => sum + diff[table].upserts.length + diff[table].deletes.length,
        0,
      );
      // user.db holds only rows for known content.
      const db = { ...args.merged };
      for (const table of SYNC_TABLE_KEYS) {
        (db as Record<SyncTableKey, unknown>)[table] = (args.merged[table] as Row<SyncTableKey>[]).filter(
          (row) => isKnownRow(table, row as never, known),
        );
      }
      device.db = db;
      device.base = { ...args.base, pendingReplace: false };
      return { ok: true as const, value: { changedRows } };
    }),
    writeBase: jest.fn(async (base: Parameters<SyncPorts['writeBase']>[0], syncedAt: string) => {
      device.base = { ...base, pendingReplace: false };
      device.lastSyncedAt = syncedAt;
      device.lastError = null;
      return { ok: true as const, value: undefined };
    }),
    clearBase: jest.fn(async () => {
      device.base = null;
      return { ok: true as const, value: undefined };
    }),
    writeError: jest.fn(async (code: string | null) => {
      device.lastError = code;
    }),
    api: {
      pull: jest.fn(async (have: number): Promise<Result<{ revision: number; bytes: Uint8Array | null }>> => ({
        ok: true as const,
        value: {
          revision: server.revision,
          bytes: server.revision === 0 || have === server.revision ? null : server.bytes,
        },
      })),
      push: jest.fn(async (baseRevision: number, bytes: Uint8Array) => {
        server.beforePush?.();
        if (server.failPush) {
          const error = server.failPush;
          server.failPush = null;
          return { ok: false as const, error };
        }
        if (baseRevision !== server.revision) {
          return { ok: false as const, error: apiError('revision_conflict') };
        }
        server.revision += 1;
        server.bytes = bytes;
        return { ok: true as const, value: { revision: server.revision } };
      }),
    },
    encode: jest.fn(encode),
    decode: jest.fn(decode),
    askConflict: jest.fn<Promise<ConflictChoice | null>, [ConflictEntry[]]>(async () =>
      options.choice === undefined ? 'local' : options.choice,
    ),
    isStudyActive: jest.fn(() => options.studyActive ?? false),
    onPhase: jest.fn((phase: 'idle' | 'syncing' | 'conflict') => {
      phases.push(phase);
    }),
    nowIso: jest.fn(() => NOW),
  };
  const runner = createSyncRunner(ports as SyncPorts);
  return { ports, device, server, phases, runner };
}

/** Device and server in step at revision 2. */
function synced(extra: Partial<Parameters<typeof harness>[0]> = {}) {
  return harness({
    db: syncedFile(),
    base: { revision: 2, data: syncedFile() },
    server: serverWith(2, syncedFile()),
    ...extra,
  });
}

function noLocalWrites(ports: ReturnType<typeof harness>['ports']): void {
  expect(ports.applyMerge).not.toHaveBeenCalled();
  expect(ports.writeBase).not.toHaveBeenCalled();
  expect(ports.clearBase).not.toHaveBeenCalled();
}

describe('createSyncRunner', () => {
  it('signed out: no port is called', async () => {
    const h = synced({ signedIn: false });

    const result = await h.runner.run('open');

    expect(result).toEqual({ status: 'skipped', error: null, changedLocal: false });
    const { isSignedIn, api, ...rest } = h.ports;
    expect(isSignedIn).toHaveBeenCalled();
    for (const fn of [...Object.values(rest), ...Object.values(api)]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('first sign-in, account empty → pushes local with base_revision 0 and writes the base', async () => {
    const h = harness({ db: syncedFile(), base: null, server: serverWith(0, null) });

    const result = await h.runner.run('open');

    expect(result).toEqual({ status: 'pushed', error: null, changedLocal: false });
    expect(h.ports.api.push).toHaveBeenCalledWith(0, expect.any(Uint8Array));
    expect(h.server.revision).toBe(1);
    expect(serverFile(h.server)).toEqual(syncedFile());
    expect(h.device.base).toEqual({ revision: 1, data: syncedFile(), pendingReplace: false, carried: {} });
    expect(h.device.lastSyncedAt).toBe(NOW);
    expect(h.ports.encode).toHaveBeenCalledWith(
      { schemaVersion: SCHEMA, curriculumVersion: '1.0.0', exportedAt: NOW },
      syncedFile(),
    );
  });

  it('first sign-in, device empty → applies the remote file, no push, no dialog', async () => {
    const h = harness({ db: emptySyncData(), base: null, server: serverWith(3, syncedFile()) });

    const result = await h.runner.run('open');

    expect(result).toEqual({ status: 'pulled', error: null, changedLocal: true });
    expect(h.device.db).toEqual(syncedFile());
    expect(h.ports.api.push).not.toHaveBeenCalled();
    expect(h.ports.askConflict).not.toHaveBeenCalled();
    expect(h.device.base?.revision).toBe(3);
    expect(h.device.base?.data).toEqual(syncedFile());
    expect(h.device.lastSyncedAt).toBe(NOW);
  });

  it('first sign-in, both have data → two-way compare; a differing item opens the dialog; rows on one side only are added', async () => {
    const local = file({ personalMnemonics: [mnemonic('1', 'phone', LOCAL_AT), mnemonic('2', 'two')] });
    const remote = file({ personalMnemonics: [mnemonic('1', 'web', REMOTE_AT), mnemonic('3', 'three')] });
    const h = harness({ db: local, base: null, server: serverWith(4, remote), choice: 'local' });

    const result = await h.runner.run('open');

    expect(result).toEqual({ status: 'merged', error: null, changedLocal: true });
    expect(h.ports.askConflict).toHaveBeenCalledTimes(1);
    expect(h.ports.askConflict).toHaveBeenCalledWith([
      { kind: 'item', item: item('1'), localUpdatedAt: LOCAL_AT, remoteUpdatedAt: REMOTE_AT },
    ]);
    const expected = [mnemonic('1', 'phone', LOCAL_AT), mnemonic('2', 'two'), mnemonic('3', 'three')];
    expect(h.device.db.personalMnemonics).toEqual(expected);
    expect(serverFile(h.server).personalMnemonics).toEqual(expected);
    expect(h.ports.api.push).toHaveBeenCalledWith(4, expect.any(Uint8Array));
    expect(h.phases).toEqual(['syncing', 'conflict', 'syncing', 'idle']);
  });

  it('remote unchanged and local unchanged → up_to_date, no push', async () => {
    const h = synced();

    const result = await h.runner.run('open');

    expect(result).toEqual({ status: 'up_to_date', error: null, changedLocal: false });
    expect(h.ports.api.pull).toHaveBeenCalledWith(2);
    expect(h.ports.api.push).not.toHaveBeenCalled();
    expect(h.ports.applyMerge).not.toHaveBeenCalled();
    expect(h.device.lastSyncedAt).toBe(NOW);
    expect(h.phases).toEqual(['syncing', 'idle']);
  });

  it('session_end with no local change makes no request', async () => {
    const h = synced();

    const result = await h.runner.run('session_end');

    expect(result).toEqual({ status: 'up_to_date', error: null, changedLocal: false });
    expect(h.ports.api.pull).not.toHaveBeenCalled();
    expect(h.ports.api.push).not.toHaveBeenCalled();
  });

  it('local changed only → push; base becomes the pushed file', async () => {
    const h = synced();
    const local = file({ ...syncedFile(), srsStates: [srs('1', 2, LOCAL_AT), srs('2', 1)] });
    h.device.db = local;

    const result = await h.runner.run('session_end');

    expect(result).toEqual({ status: 'pushed', error: null, changedLocal: false });
    expect(h.ports.api.push).toHaveBeenCalledWith(2, expect.any(Uint8Array));
    expect(h.ports.applyMerge).not.toHaveBeenCalled();
    expect(h.server.revision).toBe(3);
    expect(serverFile(h.server)).toEqual(local);
    expect(h.device.base).toEqual({ revision: 3, data: local, pendingReplace: false, carried: {} });
  });

  it('remote changed only → apply; no push', async () => {
    const h = synced();
    const remote = file({ ...syncedFile(), srsStates: [srs('1', 1), srs('2', 2, REMOTE_AT)] });
    otherDevicePushes(h.server, remote);

    const result = await h.runner.run('open');

    expect(result).toEqual({ status: 'pulled', error: null, changedLocal: true });
    expect(h.device.db).toEqual(remote);
    expect(h.ports.api.push).not.toHaveBeenCalled();
    expect(h.device.base?.revision).toBe(3);
    expect(h.device.base?.data).toEqual(remote);
  });

  it('both changed different items → apply and push, askConflict is not called, both changes are in the pushed file', async () => {
    const h = synced();
    h.device.db = file({ ...syncedFile(), srsStates: [srs('1', 2, LOCAL_AT), srs('2', 1)] });
    otherDevicePushes(h.server, file({ ...syncedFile(), srsStates: [srs('1', 1), srs('2', 2, REMOTE_AT)] }));

    const result = await h.runner.run('open');

    expect(result).toEqual({ status: 'merged', error: null, changedLocal: true });
    expect(h.ports.askConflict).not.toHaveBeenCalled();
    const both = [srs('1', 2, LOCAL_AT), srs('2', 2, REMOTE_AT)];
    expect(serverFile(h.server).srsStates).toEqual(both);
    expect(h.device.db.srsStates).toEqual(both);
    expect(h.ports.api.push).toHaveBeenCalledWith(3, expect.any(Uint8Array));
    expect(h.device.base?.revision).toBe(4);
    expect(h.device.base?.data).toEqual(serverFile(h.server));
  });

  function sameItemChanged(choice: ConflictChoice | null) {
    const h = synced({ choice });
    // Item 1 changed on both sides; item 2 changed only here, so a push follows either way.
    h.device.db = file({
      srsStates: [srs('1', 2, LOCAL_AT), srs('2', 2, LOCAL_AT)],
      personalMnemonics: [mnemonic('1', 'phone', LOCAL_AT), mnemonic('2', 'two')],
    });
    otherDevicePushes(
      h.server,
      file({
        srsStates: [srs('1', 3, REMOTE_AT), srs('2', 1)],
        personalMnemonics: [mnemonic('1', 'web', REMOTE_AT), mnemonic('2', 'two')],
      }),
    );
    return h;
  }

  it("both changed the same item → askConflict gets one entry; 'local' pushes the local rows", async () => {
    const h = sameItemChanged('local');

    const result = await h.runner.run('open');

    expect(result.status).toBe('merged');
    expect(h.ports.askConflict).toHaveBeenCalledWith([
      { kind: 'item', item: item('1'), localUpdatedAt: LOCAL_AT, remoteUpdatedAt: REMOTE_AT },
    ]);
    const pushed = serverFile(h.server);
    expect(pushed.srsStates).toEqual([srs('1', 2, LOCAL_AT), srs('2', 2, LOCAL_AT)]);
    expect(pushed.personalMnemonics).toEqual([mnemonic('1', 'phone', LOCAL_AT), mnemonic('2', 'two')]);
  });

  it("both changed the same item → askConflict gets one entry; 'remote' applies the remote rows and pushes nothing new for that item", async () => {
    const h = sameItemChanged('remote');

    const result = await h.runner.run('open');

    expect(result).toEqual({ status: 'merged', error: null, changedLocal: true });
    expect(h.ports.askConflict).toHaveBeenCalledTimes(1);
    expect(h.ports.askConflict.mock.calls[0][0]).toHaveLength(1);
    expect(h.device.db.srsStates).toEqual([srs('1', 3, REMOTE_AT), srs('2', 2, LOCAL_AT)]);
    expect(h.device.db.personalMnemonics).toEqual([mnemonic('1', 'web', REMOTE_AT), mnemonic('2', 'two')]);
    const pushed = serverFile(h.server);
    expect(pushed.srsStates).toEqual([srs('1', 3, REMOTE_AT), srs('2', 2, LOCAL_AT)]);
    expect(pushed.personalMnemonics).toEqual([mnemonic('1', 'web', REMOTE_AT), mnemonic('2', 'two')]);
  });

  it('a conflict answered with null ends the run with no apply and no push', async () => {
    const h = sameItemChanged(null);

    const result = await h.runner.run('open');

    expect(result).toEqual({ status: 'skipped', error: null, changedLocal: false });
    expect(h.ports.askConflict).toHaveBeenCalledTimes(1);
    noLocalWrites(h.ports);
    expect(h.ports.api.push).not.toHaveBeenCalled();
    expect(h.ports.writeError).not.toHaveBeenCalled();
    expect(h.phases).toEqual(['syncing', 'conflict', 'syncing', 'idle']);
  });
  it('409 on push → pulls again and merges again, then pushes', async () => {
    const h = synced();
    h.device.db = file({ ...syncedFile(), srsStates: [srs('1', 2, LOCAL_AT), srs('2', 1)] });
    h.server.beforePush = () => {
      h.server.beforePush = null;
      otherDevicePushes(h.server, file({ ...syncedFile(), srsStates: [srs('1', 1), srs('2', 2, REMOTE_AT)] }));
    };

    const result = await h.runner.run('open');

    expect(result).toEqual({ status: 'merged', error: null, changedLocal: true });
    expect(h.ports.api.pull).toHaveBeenNthCalledWith(1, 2);
    expect(h.ports.api.pull).toHaveBeenNthCalledWith(2, 2);
    expect(h.ports.api.push).toHaveBeenNthCalledWith(1, 2, expect.any(Uint8Array));
    expect(h.ports.api.push).toHaveBeenNthCalledWith(2, 3, expect.any(Uint8Array));
    expect(serverFile(h.server).srsStates).toEqual([srs('1', 2, LOCAL_AT), srs('2', 2, REMOTE_AT)]);
    expect(h.device.base?.revision).toBe(4);
    expect(h.ports.writeError).not.toHaveBeenCalled();
  });

  it('three 409s in a row → sync_busy', async () => {
    const h = synced();
    h.device.db = file({ ...syncedFile(), srsStates: [srs('1', 2, LOCAL_AT), srs('2', 1)] });
    let other = 0;
    h.server.beforePush = () => {
      other += 1;
      otherDevicePushes(h.server, file({ ...syncedFile(), cardSeen: [{ cardId: `c${other}`, seenAt: T0 }] }));
    };

    const result = await h.runner.run('open');

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('sync_busy');
    expect(h.ports.api.pull).toHaveBeenCalledTimes(3);
    expect(h.ports.api.push).toHaveBeenCalledTimes(3);
    expect(h.ports.writeError).toHaveBeenCalledWith('sync_busy');
    expect(h.phases).toEqual(['syncing', 'idle']);
  });

  /** This device deleted mnemonic 2; the other device changed srs 2. */
  function localDeleteRemoteChange() {
    const h = synced();
    h.device.db = file({ ...syncedFile(), personalMnemonics: [mnemonic('1', 'one')] });
    otherDevicePushes(h.server, file({ ...syncedFile(), srsStates: [srs('1', 1), srs('2', 2, REMOTE_AT)] }));
    return h;
  }

  it('a local delete survives a 409 after an apply', async () => {
    const h = localDeleteRemoteChange();
    h.server.beforePush = () => {
      h.server.beforePush = null;
      otherDevicePushes(
        h.server,
        file({
          ...syncedFile(),
          srsStates: [srs('1', 1), srs('2', 2, REMOTE_AT)],
          cardSeen: [{ cardId: 'welcome', seenAt: REMOTE_AT }],
        }),
      );
    };

    const result = await h.runner.run('open');

    expect(result.status).toBe('merged');
    expect(h.ports.api.push).toHaveBeenCalledTimes(2);
    expect(h.device.db.personalMnemonics).toEqual([mnemonic('1', 'one')]);
    expect(serverFile(h.server).personalMnemonics).toEqual([mnemonic('1', 'one')]);
    expect(h.device.base?.carried).toEqual({});
  });

  it('a local delete survives a network error on the push after an apply', async () => {
    const h = localDeleteRemoteChange();
    h.server.failPush = apiError('network');

    const first = await h.runner.run('open');
    expect(first.error?.code).toBe('network');
    expect(h.device.base?.carried).toEqual({});

    const second = await h.runner.run('open');

    expect(second.status).toBe('pushed');
    expect(h.device.db.personalMnemonics).toEqual([mnemonic('1', 'one')]);
    expect(serverFile(h.server).personalMnemonics).toEqual([mnemonic('1', 'one')]);
    expect(serverFile(h.server).srsStates).toEqual([srs('1', 1), srs('2', 2, REMOTE_AT)]);
  });

  it('local change during a run restarts the cycle', async () => {
    const h = synced();
    const remote = file({ ...syncedFile(), srsStates: [srs('1', 1), srs('2', 2, REMOTE_AT)] });
    otherDevicePushes(h.server, remote);
    h.ports.applyMerge.mockImplementationOnce(async () => ({
      ok: false as const,
      error: syncError('sync_local_changed'),
    }));

    const result = await h.runner.run('open');

    expect(result).toEqual({ status: 'pulled', error: null, changedLocal: true });
    expect(h.ports.readSnapshot).toHaveBeenCalledTimes(2);
    expect(h.ports.readBase).toHaveBeenCalledTimes(2);
    expect(h.ports.applyMerge).toHaveBeenCalledTimes(2);
    expect(h.device.db).toEqual(remote);
    expect(h.ports.writeError).not.toHaveBeenCalled();
  });

  it('push failure after apply is finished by the next run', async () => {
    const h = synced();
    h.device.db = file({ ...syncedFile(), srsStates: [srs('1', 2, LOCAL_AT), srs('2', 1)] });
    otherDevicePushes(h.server, file({ ...syncedFile(), srsStates: [srs('1', 1), srs('2', 2, REMOTE_AT)] }));
    h.server.failPush = apiError('network');

    const first = await h.runner.run('open');

    expect(first.status).toBe('error');
    expect(first.error?.code).toBe('network');
    expect(first.changedLocal).toBe(true);
    expect(h.ports.writeError).toHaveBeenCalledWith('network');
    expect(h.server.revision).toBe(3);

    const second = await h.runner.run('open');

    expect(second).toEqual({ status: 'pushed', error: null, changedLocal: false });
    expect(h.ports.askConflict).not.toHaveBeenCalled();
    const both = [srs('1', 2, LOCAL_AT), srs('2', 2, REMOTE_AT)];
    expect(serverFile(h.server).srsStates).toEqual(both);
    expect(h.device.db.srsStates).toEqual(both);
    expect(h.device.lastError).toBeNull();
  });

  it('damaged remote file changes nothing', async () => {
    const h = synced();
    h.device.db = file({ ...syncedFile(), srsStates: [srs('1', 2, LOCAL_AT), srs('2', 1)] });
    h.server.revision = 3;
    h.server.bytes = Uint8Array.from([1, 2, 3]);

    const result = await h.runner.run('open');

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('sync_bad_file');
    noLocalWrites(h.ports);
    expect(h.ports.api.push).not.toHaveBeenCalled();
    expect(h.ports.writeError).toHaveBeenCalledWith('sync_bad_file');
  });

  it('an invalid local row is not pushed', async () => {
    const bad = { ...srs('1', 1), reps: 'many' } as unknown as Row<'srsStates'>;
    const h = harness({
      db: file({ srsStates: [bad, srs('2', 1)] }),
      base: null,
      server: serverWith(0, null),
    });

    const result = await h.runner.run('open');

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('sync_bad_file');
    expect(h.ports.api.push).not.toHaveBeenCalled();
    expect(h.server.revision).toBe(0);
    expect(h.server.bytes).toBeNull();
    expect(h.ports.writeBase).not.toHaveBeenCalled();
    expect(h.ports.writeError).toHaveBeenCalledWith('sync_bad_file');
  });

  it('an encode failure stops the run with an error and pushes nothing', async () => {
    const h = harness({ db: syncedFile(), base: null, server: serverWith(0, null) });
    h.ports.encode.mockRejectedValueOnce(new Error('boom'));

    const result = await h.runner.run('open');

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('sync_local_failed');
    expect(h.ports.api.push).not.toHaveBeenCalled();
    expect(h.server.revision).toBe(0);
    expect(h.ports.writeBase).not.toHaveBeenCalled();
    expect(h.ports.writeError).toHaveBeenCalledWith('sync_local_failed');
  });

  it('remote schemaVersion newer → sync_update_required, no apply, no push', async () => {
    const h = synced();
    const newer = serverWith(3, file({ ...syncedFile(), srsStates: [srs('1', 9, REMOTE_AT)] }), SCHEMA + 1);
    Object.assign(h.server, newer);

    const result = await h.runner.run('open');

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('sync_update_required');
    noLocalWrites(h.ports);
    expect(h.ports.api.push).not.toHaveBeenCalled();
    expect(h.ports.writeError).toHaveBeenCalledWith('sync_update_required');
  });

  it('remote revision below base drops the base', async () => {
    // The account was deleted and made again: the server is at revision 2, the base at 9.
    const local = file({ personalMnemonics: [mnemonic('1', 'one'), mnemonic('2', 'two')] });
    const h = harness({
      db: local,
      base: { revision: 9, data: local },
      server: serverWith(2, file({ personalMnemonics: [mnemonic('1', 'one'), mnemonic('3', 'three')] })),
    });

    const result = await h.runner.run('open');

    expect(result.status).toBe('merged');
    expect(h.ports.clearBase).toHaveBeenCalledTimes(1);
    expect(h.ports.askConflict).not.toHaveBeenCalled();
    const all = [mnemonic('1', 'one'), mnemonic('2', 'two'), mnemonic('3', 'three')];
    expect(h.device.db.personalMnemonics).toEqual(all);
    expect(serverFile(h.server).personalMnemonics).toEqual(all);
    expect(h.device.base?.revision).toBe(3);
  });

  it('unknown-item rows from the base are in the pushed file', async () => {
    // Item 9 is in the base but not in this curriculum, so user.db does not hold it.
    const base = file({
      srsStates: [srs('1', 1), srs('9', 4)],
      personalMnemonics: [mnemonic('9', 'nine')],
    });
    const h = harness({
      db: file({ srsStates: [srs('1', 2, LOCAL_AT)] }),
      base: { revision: 2, data: base },
      server: serverWith(2, base),
      unknownSlugs: ['9'],
    });

    const result = await h.runner.run('open');

    expect(result.status).toBe('pushed');
    const pushed = serverFile(h.server);
    expect(pushed.srsStates).toEqual([srs('1', 2, LOCAL_AT), srs('9', 4)]);
    expect(pushed.personalMnemonics).toEqual([mnemonic('9', 'nine')]);
    expect(h.device.base?.data).toEqual(pushed);
    expect(h.device.base?.carried).toEqual({
      srsStates: [rowKey('srsStates', srs('9', 4))],
      personalMnemonics: [rowKey('personalMnemonics', mnemonic('9', 'nine'))],
    });
  });

  it('item learned by a curriculum update keeps its synced rows', async () => {
    // Item 9 was unknown when the base was written (carried); a curriculum update made it known,
    // and user.db still lacks its rows.
    const base = file({
      srsStates: [srs('1', 1), srs('9', 4)],
      personalMnemonics: [mnemonic('9', 'nine')],
    });
    const h = harness({
      db: file({ srsStates: [srs('1', 2, LOCAL_AT)] }),
      base: {
        revision: 2,
        data: base,
        carried: {
          srsStates: [rowKey('srsStates', srs('9', 4))],
          personalMnemonics: [rowKey('personalMnemonics', mnemonic('9', 'nine'))],
        },
      },
      server: serverWith(2, base),
    });
    otherDevicePushes(h.server, file({ ...base, cardSeen: [{ cardId: 'welcome', seenAt: REMOTE_AT }] }));

    const result = await h.runner.run('open');

    expect(result.status).toBe('merged');
    expect(h.device.db.srsStates).toEqual([srs('1', 2, LOCAL_AT), srs('9', 4)]);
    expect(h.device.db.personalMnemonics).toEqual([mnemonic('9', 'nine')]);
    const pushed = serverFile(h.server);
    expect(pushed.srsStates).toEqual([srs('1', 2, LOCAL_AT), srs('9', 4)]);
    expect(pushed.personalMnemonics).toEqual([mnemonic('9', 'nine')]);
    expect(h.device.base?.carried).toEqual({});
  });

  it('study active and the merge would change local rows → deferred, nothing written', async () => {
    const h = synced({ studyActive: true });
    otherDevicePushes(h.server, file({ ...syncedFile(), srsStates: [srs('1', 1), srs('2', 2, REMOTE_AT)] }));

    const result = await h.runner.run('before_review');

    expect(result).toEqual({ status: 'deferred', error: null, changedLocal: false });
    noLocalWrites(h.ports);
    expect(h.ports.writeError).not.toHaveBeenCalled();
    expect(h.ports.api.push).not.toHaveBeenCalled();
    expect(h.device.db).toEqual(syncedFile());
  });

  it('study active and only a push is needed → pushes', async () => {
    const h = synced({ studyActive: true });
    const local = file({ ...syncedFile(), srsStates: [srs('1', 2, LOCAL_AT), srs('2', 1)] });
    h.device.db = local;

    const result = await h.runner.run('session_end');

    expect(result.status).toBe('pushed');
    expect(serverFile(h.server)).toEqual(local);
  });

  it('pending replace → pushes local over the remote without a merge and clears the flag', async () => {
    const restored = file({ personalMnemonics: [mnemonic('1', 'restored', LOCAL_AT)] });
    const h = harness({
      db: restored,
      base: { revision: 2, data: restored, pendingReplace: true },
      server: serverWith(5, file({ personalMnemonics: [mnemonic('1', 'web', REMOTE_AT)] })),
    });

    const result = await h.runner.run('session_end');

    expect(result).toEqual({ status: 'pushed', error: null, changedLocal: false });
    expect(h.ports.api.push).toHaveBeenCalledWith(5, expect.any(Uint8Array));
    expect(h.ports.applyMerge).not.toHaveBeenCalled();
    expect(h.ports.askConflict).not.toHaveBeenCalled();
    expect(serverFile(h.server)).toEqual(restored);
    expect(h.device.base).toEqual({ revision: 6, data: restored, pendingReplace: false, carried: {} });
  });

  it('pending replace with a newer remote schema → sync_update_required', async () => {
    const restored = file({ personalMnemonics: [mnemonic('1', 'restored', LOCAL_AT)] });
    const h = harness({
      db: restored,
      base: { revision: 2, data: restored, pendingReplace: true },
      server: serverWith(5, file({ personalMnemonics: [mnemonic('1', 'web', REMOTE_AT)] }), SCHEMA + 1),
    });

    const result = await h.runner.run('open');

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('sync_update_required');
    expect(h.ports.api.push).not.toHaveBeenCalled();
    noLocalWrites(h.ports);
    expect(h.device.base?.pendingReplace).toBe(true);
  });

  it('second run while the first is in flight returns the same promise', async () => {
    const h = synced();

    const first = h.runner.run('open');
    const second = h.runner.run('background');
    const third = h.runner.run('before_review');

    expect(second).toBe(first);
    expect(third).toBe(first);
    await first;
    expect(h.ports.api.pull).toHaveBeenCalledTimes(1);
  });

  it('a session_end trigger during a run starts one more run', async () => {
    const h = synced();
    const local = file({ ...syncedFile(), srsStates: [srs('1', 2, LOCAL_AT), srs('2', 1)] });
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pull = h.ports.api.pull.getMockImplementation() as SyncPorts['api']['pull'];
    h.ports.api.pull.mockImplementationOnce(async (have: number) => {
      await gate;
      return pull(have);
    });

    const first = h.runner.run('open');
    while (h.ports.api.pull.mock.calls.length === 0) await Promise.resolve();
    // The learner finishes a session after the first run read the snapshot.
    h.device.db = local;
    const second = h.runner.run('session_end');
    const third = h.runner.run('manual');
    release();

    expect(second).not.toBe(first);
    expect(third).toBe(second);
    const firstResult = await first;
    const secondResult = await second;

    expect(h.ports.readSnapshot).toHaveBeenCalledTimes(2);
    expect(firstResult.status).toBe('up_to_date');
    expect(secondResult.status).toBe('pushed');
    expect(serverFile(h.server)).toEqual(local);
  });

  it('quota error from the API is returned as paused and written as the last error', async () => {
    const h = synced();
    h.device.db = file({ ...syncedFile(), srsStates: [srs('1', 2, LOCAL_AT), srs('2', 1)] });
    h.server.failPush = apiError('paused');

    const result = await h.runner.run('manual');

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('paused');
    expect(h.ports.writeError).toHaveBeenCalledWith('paused');
    expect(h.device.lastError).toBe('paused');
    expect(h.ports.writeBase).not.toHaveBeenCalled();
  });

  it('session_ended is returned and not written as the last error', async () => {
    const h = synced();
    h.ports.api.pull.mockResolvedValueOnce({ ok: false, error: apiError('session_ended') });

    const result = await h.runner.run('open');

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('session_ended');
    expect(h.ports.writeError).not.toHaveBeenCalled();
    expect(h.phases).toEqual(['syncing', 'idle']);
  });

  describe('carried items a curriculum update made known', () => {
    // Item 9 was unknown when the base was written, so its rows were carried; it is known now.
    const carriedBase = (): BackupData =>
      file({ srsStates: [srs('1', 1), srs('9', 4)], personalMnemonics: [mnemonic('9', 'nine')] });
    const carried: CarriedKeys = {
      srsStates: [rowKey('srsStates', srs('9', 4))],
      personalMnemonics: [rowKey('personalMnemonics', mnemonic('9', 'nine'))],
    };

    function carriedItem(db: BackupData, extra: Partial<Parameters<typeof harness>[0]> = {}) {
      return harness({
        db,
        base: { revision: 2, data: carriedBase(), carried },
        server: serverWith(2, carriedBase()),
        ...extra,
      });
    }

    it('known carried rows are written to the device when the remote is unchanged', async () => {
      const h = carriedItem(file({ srsStates: [srs('1', 1)] }));

      const result = await h.runner.run('session_end');

      expect(result).toEqual({ status: 'up_to_date', error: null, changedLocal: true });
      expect(h.ports.applyMerge).toHaveBeenCalledTimes(1);
      expect(h.device.db).toEqual(carriedBase());
      expect(h.device.base).toEqual({ revision: 2, data: carriedBase(), pendingReplace: false, carried: {} });
      expect(h.ports.api.pull).not.toHaveBeenCalled();
      expect(h.ports.api.push).not.toHaveBeenCalled();
    });

    it('known carried rows are not written while study is active', async () => {
      const h = carriedItem(file({ srsStates: [srs('1', 1)] }), { studyActive: true });

      const result = await h.runner.run('session_end');

      expect(result).toEqual({ status: 'up_to_date', error: null, changedLocal: false });
      expect(h.ports.applyMerge).not.toHaveBeenCalled();
      expect(h.device.db).toEqual(file({ srsStates: [srs('1', 1)] }));
      expect(h.device.base?.carried).toEqual(carried);
    });

    it('a row this device wrote for a carried item opens the dialog when the remote is unchanged', async () => {
      // The learner studied item 9 here before its synced rows were written.
      const h = carriedItem(file({ srsStates: [srs('1', 1), srs('9', 1, LOCAL_AT)] }), { choice: 'remote' });

      const result = await h.runner.run('open');

      expect(h.ports.askConflict).toHaveBeenCalledWith([
        { kind: 'item', item: item('9'), localUpdatedAt: LOCAL_AT, remoteUpdatedAt: T0 },
      ]);
      expect(result).toEqual({ status: 'pulled', error: null, changedLocal: true });
      expect(h.device.db).toEqual(carriedBase());
      expect(h.ports.api.push).not.toHaveBeenCalled();
      expect(h.device.base?.carried).toEqual({});
    });

    it('a row this device wrote for a carried item opens the dialog when the remote changed', async () => {
      const h = carriedItem(file({ srsStates: [srs('1', 1), srs('9', 1, LOCAL_AT)] }), { choice: 'local' });
      otherDevicePushes(h.server, file({ ...carriedBase(), srsStates: [srs('1', 2, REMOTE_AT), srs('9', 4)] }));

      const result = await h.runner.run('open');

      expect(h.ports.askConflict).toHaveBeenCalledWith([
        { kind: 'item', item: item('9'), localUpdatedAt: LOCAL_AT, remoteUpdatedAt: T0 },
      ]);
      expect(result.status).toBe('merged');
      const pushed = serverFile(h.server);
      expect(pushed.srsStates).toEqual([srs('1', 2, REMOTE_AT), srs('9', 1, LOCAL_AT)]);
      // The carried mnemonic was written to the device first, so it is on the local side too.
      expect(pushed.personalMnemonics).toEqual([mnemonic('9', 'nine')]);
      expect(h.device.db.srsStates).toEqual(pushed.srsStates);
    });

    it('a local delete survives the carried-row write', async () => {
      // Mnemonic 1 was synced (not carried); the learner deleted it on this device.
      const base = file({ ...carriedBase(), personalMnemonics: [mnemonic('1', 'one'), mnemonic('9', 'nine')] });
      const h = harness({
        db: file({ srsStates: [srs('1', 1)] }),
        base: { revision: 2, data: base, carried },
        server: serverWith(2, base),
      });

      const result = await h.runner.run('open');

      expect(result).toEqual({ status: 'pushed', error: null, changedLocal: true });
      expect(serverFile(h.server).personalMnemonics).toEqual([mnemonic('9', 'nine')]);
      expect(h.device.db.personalMnemonics).toEqual([mnemonic('9', 'nine')]);

      await h.runner.run('open');
      expect(h.device.db.personalMnemonics).toEqual([mnemonic('9', 'nine')]);
      expect(serverFile(h.server).personalMnemonics).toEqual([mnemonic('9', 'nine')]);
    });

    it('defer when the apply would change a device row', async () => {
      // The other device pushed the same content again: the merge equals local, but the apply
      // would still write item 9's carried rows to user.db.
      const h = carriedItem(file({ srsStates: [srs('1', 1)] }), { studyActive: true });
      otherDevicePushes(h.server, file({ ...carriedBase(), srsStates: [srs('1', 1, REMOTE_AT), srs('9', 4)] }));

      const result = await h.runner.run('before_review');

      expect(result).toEqual({ status: 'deferred', error: null, changedLocal: false });
      noLocalWrites(h.ports);
      expect(h.device.db).toEqual(file({ srsStates: [srs('1', 1)] }));
    });
  });

  it('manual during a queued session_end run upgrades it', async () => {
    const h = synced();
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pull = h.ports.api.pull.getMockImplementation() as SyncPorts['api']['pull'];
    h.ports.api.pull.mockImplementationOnce(async (have: number) => {
      await gate;
      return pull(have);
    });

    const first = h.runner.run('open');
    const queued = h.runner.run('session_end');
    const manual = h.runner.run('manual');
    release();

    expect(manual).toBe(queued);
    await first;
    await queued;
    // A session_end run with no local change makes no request; the manual run pulls.
    expect(h.ports.api.pull).toHaveBeenCalledTimes(2);
  });

  it('a rejecting port leaves the phase idle', async () => {
    const h = synced();
    const failure = new Error('disk gone');
    h.ports.readBase.mockRejectedValueOnce(failure);

    // A port that rejects (ports return Results; this is outside the contract) rejects the run.
    await expect(h.runner.run('open')).rejects.toBe(failure);
    expect(h.phases).toEqual(['syncing', 'idle']);

    // The runner is free for the next run.
    const next = await h.runner.run('open');
    expect(next.status).toBe('up_to_date');
  });
});
