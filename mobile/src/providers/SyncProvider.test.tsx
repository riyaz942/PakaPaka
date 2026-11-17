import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { AccountSession } from '@/core/account/account.types';
import { accountError } from '@/core/account/apiClient';
import type { BackupData } from '@/core/backup/backup.types';
import { carriedKeysOf } from '@/core/sync/mergeSyncData';
import type { ConflictChoice, ConflictEntry } from '@/core/sync/sync.types';
import { toSyncData } from '@/core/sync/syncFile';
import type { SyncPorts, SyncRunResult, SyncTrigger } from '@/core/sync/syncRunner';
import { fullSampleData } from '@/core/sync/syncSamples.testutil';
import { clearSyncBase, markPendingReplace, readSyncStatus } from '@/data/sync/syncBaseStore';
import { readSyncSnapshot, type SyncSnapshot } from '@/data/sync/syncSnapshot';
import { SyncProvider, useSync, type SyncContextValue } from '@/providers/SyncProvider';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { google: { webClientId: 'web-id', iosClientId: 'ios-id' } } } },
}));
jest.mock('expo-device', () => ({ __esModule: true, modelName: 'Pixel 9' }));

const mockRefresh = jest.fn(async () => undefined);
let mockStatus: 'signed_out' | 'loading' | 'signed_in' = 'signed_out';
jest.mock('@/providers/AccountProvider', () => ({
  useAccount: () => ({ status: mockStatus, refresh: mockRefresh }),
}));

const mockUserDb = { name: 'user.db' };
jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: mockUserDb }),
}));

jest.mock('@/data/sync/syncSnapshot', () => ({ readSyncSnapshot: jest.fn() }));
jest.mock('@/data/sync/syncApply', () => ({ applySyncMerge: jest.fn() }));
jest.mock('@/data/sync/syncBaseStore', () => ({
  readSyncBase: jest.fn(),
  writeSyncBase: jest.fn(),
  markPendingReplace: jest.fn(),
  readSyncStatus: jest.fn(),
  writeSyncError: jest.fn(),
  clearSyncBase: jest.fn(),
}));

let mockPorts: SyncPorts;
const mockRun = jest.fn<Promise<SyncRunResult>, [SyncTrigger]>();
// Like the real runner: a signed-out run is skipped before any other port is called.
jest.mock('@/core/sync/syncRunner', () => ({
  createSyncRunner: (ports: SyncPorts) => {
    mockPorts = ports;
    return {
      run: async (trigger: SyncTrigger): Promise<SyncRunResult> =>
        (await ports.isSignedIn())
          ? mockRun(trigger)
          : { status: 'skipped', error: null, changedLocal: false },
    };
  },
}));

const UP_TO_DATE: SyncRunResult = { status: 'up_to_date', error: null, changedLocal: false };
const SYNCED_AT = '2026-11-17T10:00:00.000Z';

function fakeSession(): jest.Mocked<AccountSession> {
  return {
    isSignedIn: jest.fn(),
    signIn: jest.fn(),
    getAccount: jest.fn(),
    removeDevice: jest.fn(),
    signOut: jest.fn(),
    signOutEverywhere: jest.fn(),
    deleteAccount: jest.fn(),
    request: jest.fn(),
  } as jest.Mocked<AccountSession>;
}

let latest: SyncContextValue;
function Probe() {
  latest = useSync();
  return null;
}

function renderProvider(session: AccountSession = fakeSession()) {
  const tree = () => (
    <SyncProvider session={session}>
      <Probe />
    </SyncProvider>
  );
  const view = render(tree());
  return { ...view, rerenderTree: () => view.rerender(tree()) };
}

let appStateHandlers: ((state: AppStateStatus) => void)[];
let addListenerSpy: jest.SpyInstance;
let fetchSpy: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = 'signed_out';
  mockRun.mockResolvedValue(UP_TO_DATE);
  jest.mocked(readSyncStatus).mockResolvedValue({
    ok: true,
    value: { lastSyncedAt: SYNCED_AT, lastErrorCode: null },
  });
  jest.mocked(clearSyncBase).mockResolvedValue({ ok: true, value: undefined });
  jest.mocked(markPendingReplace).mockResolvedValue({ ok: true, value: undefined });
  appStateHandlers = [];
  addListenerSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandlers.push(handler as (state: AppStateStatus) => void);
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  fetchSpy = jest.fn();
  global.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => addListenerSpy.mockRestore());

describe('SyncProvider', () => {
  it('signed out: no fetch, no snapshot read, no AppState listener', async () => {
    const session = fakeSession();
    renderProvider(session);
    await act(async () => {});
    await act(async () => {
      latest.beginStudy();
      latest.endStudy();
      await latest.syncNow();
      await latest.runBeforeReview();
      await latest.replaceRemoteAfterRestore(fullSampleData());
    });
    // The session_end run of endStudy starts on the next tick.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

    expect(mockRun).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(session.request).not.toHaveBeenCalled();
    expect(readSyncSnapshot).not.toHaveBeenCalled();
    expect(readSyncStatus).not.toHaveBeenCalled();
    expect(markPendingReplace).not.toHaveBeenCalled();
    expect(addListenerSpy).not.toHaveBeenCalled();
    expect(await mockPorts.isSignedIn()).toBe(false);
    expect(latest.phase).toBe('idle');
    expect(latest.lastSyncedAt).toBeNull();
  });

  it('signed in on mount → one run with trigger open', async () => {
    mockStatus = 'signed_in';
    renderProvider();

    await waitFor(() => expect(latest.lastSyncedAt).toBe(SYNCED_AT));
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith('open');
    expect(await mockPorts.isSignedIn()).toBe(true);
  });

  it('status change to signed_out clears the base', async () => {
    mockStatus = 'signed_in';
    const { rerenderTree } = renderProvider();
    await waitFor(() => expect(latest.lastSyncedAt).toBe(SYNCED_AT));

    mockStatus = 'signed_out';
    rerenderTree();

    await waitFor(() => expect(clearSyncBase).toHaveBeenCalledWith(mockUserDb));
    expect(latest.lastSyncedAt).toBeNull();
    expect(latest.error).toBeNull();
    expect(await mockPorts.isSignedIn()).toBe(false);
  });

  it('AppState background → run with trigger background', async () => {
    mockStatus = 'signed_in';
    renderProvider();
    await waitFor(() => expect(mockRun).toHaveBeenCalledWith('open'));
    expect(appStateHandlers).toHaveLength(1);

    await act(async () => appStateHandlers[0]('active'));
    expect(mockRun).toHaveBeenCalledTimes(1);

    await act(async () => appStateHandlers[0]('background'));
    expect(mockRun).toHaveBeenCalledTimes(2);
    expect(mockRun).toHaveBeenLastCalledWith('background');
  });

  it('conflict: conflicts is set until chooseConflict, then the run continues', async () => {
    const entries: ConflictEntry[] = [
      {
        kind: 'item',
        item: { itemType: 'kanji', slug: 'water' },
        localUpdatedAt: '2026-11-16T08:00:00.000Z',
        remoteUpdatedAt: '2026-11-16T09:00:00.000Z',
      },
    ];
    let chosen: ConflictChoice | null = null;
    mockRun.mockImplementation(async () => {
      chosen = await mockPorts.askConflict(entries);
      return { status: 'merged', error: null, changedLocal: false };
    });
    mockStatus = 'signed_in';
    renderProvider();

    await waitFor(() => expect(latest.conflicts).toEqual(entries));
    expect(chosen).toBeNull();

    act(() => latest.chooseConflict('remote'));

    await waitFor(() => expect(chosen).toBe('remote'));
    expect(latest.conflicts).toBeNull();
  });

  it('appliedVersion rises after a run that changed local rows', async () => {
    mockRun.mockResolvedValueOnce({ status: 'pulled', error: null, changedLocal: true });
    mockStatus = 'signed_in';
    renderProvider();

    await waitFor(() => expect(latest.appliedVersion).toBe(1));

    await act(() => latest.syncNow());
    expect(mockRun).toHaveBeenLastCalledWith('manual');
    expect(latest.appliedVersion).toBe(1);
  });

  it('replaceRemoteAfterRestore marks pending replace then runs', async () => {
    const restored = fullSampleData();
    const snapshot: SyncSnapshot = {
      data: restored,
      schemaVersion: 22,
      lookup: {
        idToRef: new Map(),
        refToId: new Map(),
        known: { hasItem: () => true, hasPassageQuestion: () => true },
        curriculumVersion: '1.0.0',
      },
    };
    jest.mocked(readSyncSnapshot).mockResolvedValue({ ok: true, value: snapshot });
    mockStatus = 'signed_in';
    renderProvider();
    await waitFor(() => expect(mockRun).toHaveBeenCalledWith('open'));

    await act(() => latest.replaceRemoteAfterRestore(restored));

    const file: BackupData = toSyncData(restored);
    expect(readSyncSnapshot).toHaveBeenCalledWith(mockUserDb);
    expect(markPendingReplace).toHaveBeenCalledWith(
      mockUserDb,
      file,
      carriedKeysOf(file, restored, snapshot.lookup.known),
    );
    expect(mockRun).toHaveBeenLastCalledWith('manual');
    expect(jest.mocked(markPendingReplace).mock.invocationCallOrder[0]).toBeLessThan(
      mockRun.mock.invocationCallOrder[1],
    );
  });

  it('endStudy starts a session_end run after the current tick', async () => {
    mockStatus = 'signed_in';
    renderProvider();
    await waitFor(() => expect(mockRun).toHaveBeenCalledWith('open'));

    act(() => latest.beginStudy());
    expect(mockPorts.isStudyActive()).toBe(true);

    act(() => latest.endStudy());
    expect(mockPorts.isStudyActive()).toBe(false);
    expect(mockRun).not.toHaveBeenCalledWith('session_end');

    await waitFor(() => expect(mockRun).toHaveBeenCalledWith('session_end'));
  });

  it('a session_ended run refreshes the account and shows no sync error', async () => {
    mockRun.mockResolvedValueOnce({
      status: 'error',
      error: accountError('session_ended'),
      changedLocal: false,
    });
    mockStatus = 'signed_in';
    renderProvider();

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(latest.error).toBeNull();
  });

  it('a failed run shows its message', async () => {
    mockRun.mockResolvedValueOnce({
      status: 'error',
      error: accountError('paused'),
      changedLocal: false,
    });
    mockStatus = 'signed_in';
    renderProvider();

    await waitFor(() =>
      expect(latest.error).toBe(
        'Sync is paused until tomorrow — your progress is safe on this device.',
      ),
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
