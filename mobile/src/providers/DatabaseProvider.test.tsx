import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform, Text } from 'react-native';

import { DatabaseProvider } from '@/providers/DatabaseProvider';
import { useTabMode } from '@/providers/TabModeContext';

const mockInitializeDatabases = jest.fn();
const mockCheckAndApplyCurriculumUpdate = jest.fn();

jest.mock('@/data/database', () => ({
  initializeDatabases: () => mockInitializeDatabases(),
}));

const mockRequestPersistentStorage = jest.fn();

jest.mock('@/platform/requestPersistentStorage', () => ({
  requestPersistentStorage: () => mockRequestPersistentStorage(),
}));

jest.mock('@/data/curriculum/curriculumUpdate', () => ({
  checkAndApplyCurriculumUpdate: (handles: unknown) => mockCheckAndApplyCurriculumUpdate(handles),
}));

const mockTryAcquireDbLock = jest.fn();
const mockServeOwnerTab = jest.fn();
const mockRequestSnapshot = jest.fn();
const mockUseHere = jest.fn();
const mockSerializeDatabases = jest.fn();
const mockOpenSnapshotDatabases = jest.fn();

jest.mock('@/platform/web/dbLock', () => ({
  TAB_ANSWER_TIMEOUT_MS: 5000,
  tryAcquireDbLock: () => mockTryAcquireDbLock(),
}));

jest.mock('@/platform/web/tabChannel', () => ({
  serveOwnerTab: (opts: unknown) => mockServeOwnerTab(opts),
  requestSnapshot: (timeoutMs: number) => mockRequestSnapshot(timeoutMs),
  useHere: (timeoutMs: number) => mockUseHere(timeoutMs),
}));

jest.mock('@/data/snapshotDatabases', () => ({
  serializeDatabases: (handles: unknown) => mockSerializeDatabases(handles),
  openSnapshotDatabases: (snapshot: unknown) => mockOpenSnapshotDatabases(snapshot),
}));

function setPlatform(os: 'ios' | 'web') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

function fakeHandles() {
  return {
    curriculumDb: { closeAsync: jest.fn(), getFirstSync: jest.fn() },
    userDb: { closeAsync: jest.fn(), getFirstSync: jest.fn() },
  };
}

// The Jest environment has no page events. On web the provider listens for
// them, so every web render needs these stand-ins.
type PageListener = (event: { persisted: boolean }) => void;
const browser = window as unknown as {
  addEventListener: unknown;
  removeEventListener: unknown;
  dispatchEvent: unknown;
  location: unknown;
};
let listeners: Record<string, PageListener>;
const reload = jest.fn();

describe('DatabaseProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listeners = {};
    browser.addEventListener = jest.fn((type: string, listener: PageListener) => {
      listeners[type] = listener;
    });
    browser.removeEventListener = jest.fn();
    browser.dispatchEvent = jest.fn();
    browser.location = { reload };
    mockTryAcquireDbLock.mockResolvedValue({ release: jest.fn() });
    mockServeOwnerTab.mockReturnValue(jest.fn());
    mockCheckAndApplyCurriculumUpdate.mockResolvedValue({ status: 'noop' });
    mockRequestPersistentStorage.mockResolvedValue('granted');
    mockInitializeDatabases.mockResolvedValue({ ok: true, value: fakeHandles() });
  });

  afterEach(() => setPlatform('ios'));

  it('checks for a curriculum update in the background on native', async () => {
    setPlatform('ios');
    render(
      <DatabaseProvider>
        <Text>ready</Text>
      </DatabaseProvider>,
    );
    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy());
    await waitFor(() => expect(mockCheckAndApplyCurriculumUpdate).toHaveBeenCalledTimes(1));
  });

  it('checks for a curriculum update on web too', async () => {
    setPlatform('web');
    render(
      <DatabaseProvider>
        <Text>ready</Text>
      </DatabaseProvider>,
    );
    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy());
    await waitFor(() => expect(mockCheckAndApplyCurriculumUpdate).toHaveBeenCalledTimes(1));
  });

  it('asks the browser for persistent storage once, after the databases open', async () => {
    setPlatform('web');
    render(
      <DatabaseProvider>
        <Text>ready</Text>
      </DatabaseProvider>,
    );
    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy());
    expect(mockRequestPersistentStorage).toHaveBeenCalledTimes(1);
  });

  // The SQLite worker stops when the page hides (patches/expo-sqlite), so a
  // page that the browser restores from its back/forward cache has no databases.
  describe('when the browser shows the page again', () => {
    async function renderReady(os: 'ios' | 'web') {
      setPlatform(os);
      render(
        <DatabaseProvider>
          <Text>ready</Text>
        </DatabaseProvider>,
      );
      await waitFor(() => expect(screen.getByText('ready')).toBeTruthy());
    }

    it('reloads a page that comes back from the back/forward cache', async () => {
      await renderReady('web');
      listeners.pageshow({ persisted: true });
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('does not reload on a normal page show', async () => {
      await renderReady('web');
      listeners.pageshow({ persisted: false });
      expect(reload).not.toHaveBeenCalled();
    });

    it('does not listen for page events on native', async () => {
      await renderReady('ios');
      expect(browser.addEventListener).not.toHaveBeenCalled();
    });
  });

  describe('when the databases cannot be opened', () => {
    const SECOND_TAB_HINT =
      'If PakaPaka is open in another tab, close that tab and reload this page.';

    beforeEach(() => {
      mockInitializeDatabases.mockResolvedValue({
        ok: false,
        error: { code: 'DB_OPEN_FAILED', message: 'NoModificationAllowedError' },
      });
    });

    it('explains the second-tab case on web', async () => {
      setPlatform('web');
      render(
        <DatabaseProvider>
          <Text>ready</Text>
        </DatabaseProvider>,
      );
      await waitFor(() =>
        expect(screen.getByText('Unable to open local databases.')).toBeTruthy(),
      );
      expect(screen.getByText(SECOND_TAB_HINT)).toBeTruthy();
      // Plain hint only: the raw SQLite error means nothing to the learner.
      expect(screen.queryByText('NoModificationAllowedError')).toBeNull();
      expect(mockRequestPersistentStorage).not.toHaveBeenCalled();
    });

    it('names the other tab and offers a reload when another tab holds the files', async () => {
      setPlatform('web');
      mockInitializeDatabases.mockResolvedValue({
        ok: false,
        error: { code: 'DB_LOCKED_BY_OTHER_TAB', message: 'NoModificationAllowedError' },
      });
      render(
        <DatabaseProvider>
          <Text>ready</Text>
        </DatabaseProvider>,
      );
      await waitFor(() =>
        expect(screen.getByText('PakaPaka is open in another tab')).toBeTruthy(),
      );
      expect(
        screen.getByText(
          'PakaPaka can run in only one tab at a time. Go back to the other tab, or close it and reload this page.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText('Unable to open local databases.')).toBeNull();
      expect(screen.queryByText('NoModificationAllowedError')).toBeNull();

      fireEvent.press(screen.getByRole('button', { name: 'Reload' }));
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('does not mention tabs on iOS', async () => {
      setPlatform('ios');
      render(
        <DatabaseProvider>
          <Text>ready</Text>
        </DatabaseProvider>,
      );
      await waitFor(() =>
        expect(screen.getByText('Unable to open local databases.')).toBeTruthy(),
      );
      expect(screen.queryByText(SECOND_TAB_HINT)).toBeNull();
      expect(screen.getByText('NoModificationAllowedError')).toBeTruthy();
    });
  });
  describe('web tab modes', () => {
    const SNAPSHOT = { curriculum: new Uint8Array([1]), user: new Uint8Array([2]) };
    const NOT_RESPONDING = {
      ok: false,
      error: { code: 'TAB_NOT_RESPONDING', message: 'timeout' },
    };

    function ModeProbe() {
      const { browseOnly } = useTabMode();
      return <Text>{`ready browseOnly:${String(browseOnly)}`}</Text>;
    }

    function UseHereProbe() {
      const tabMode = useTabMode();
      return <Text onPress={() => tabMode.useHere()}>use here from app</Text>;
    }

    function renderWeb(children: React.ReactNode = <ModeProbe />) {
      setPlatform('web');
      return render(<DatabaseProvider>{children}</DatabaseProvider>);
    }

    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((r) => {
        resolve = r;
      });
      return { promise, resolve };
    }

    it('web: takes the owner path when the lock is free and serves snapshots', async () => {
      const handles = fakeHandles();
      mockInitializeDatabases.mockResolvedValue({ ok: true, value: handles });
      mockSerializeDatabases.mockResolvedValue({ ok: true, value: SNAPSHOT });

      renderWeb();

      await waitFor(() => expect(screen.getByText('ready browseOnly:false')).toBeTruthy());
      expect(mockServeOwnerTab).toHaveBeenCalledTimes(1);
      expect(mockRequestSnapshot).not.toHaveBeenCalled();
      const { getSnapshot } = mockServeOwnerTab.mock.calls[0][0];
      await expect(getSnapshot()).resolves.toEqual({ ok: true, value: SNAPSHOT });
      expect(mockSerializeDatabases).toHaveBeenCalledWith(handles);
    });

    it('web: shows the intro modal when the lock is held, and asks for a snapshot at once', async () => {
      mockTryAcquireDbLock.mockResolvedValue(null);
      mockRequestSnapshot.mockReturnValue(new Promise(() => {}));

      renderWeb();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Browse' })).toBeTruthy());
      expect(screen.getByRole('button', { name: 'Use here' })).toBeTruthy();
      expect(mockRequestSnapshot).toHaveBeenCalledWith(5000);
      expect(mockInitializeDatabases).not.toHaveBeenCalled();
      expect(screen.queryByText(/ready browseOnly/)).toBeNull();
    });

    it('web: Browse opens the snapshot and renders children with browseOnly true', async () => {
      mockTryAcquireDbLock.mockResolvedValue(null);
      mockRequestSnapshot.mockResolvedValue({ ok: true, value: SNAPSHOT });
      mockOpenSnapshotDatabases.mockResolvedValue({ ok: true, value: fakeHandles() });

      renderWeb();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Browse' })).toBeTruthy());
      fireEvent.press(screen.getByRole('button', { name: 'Browse' }));

      await waitFor(() => expect(screen.getByText('ready browseOnly:true')).toBeTruthy());
      expect(mockOpenSnapshotDatabases).toHaveBeenCalledWith(SNAPSHOT);
    });

    it('web: browse-only skips the curriculum update and persistent storage', async () => {
      mockTryAcquireDbLock.mockResolvedValue(null);
      mockRequestSnapshot.mockResolvedValue({ ok: true, value: SNAPSHOT });
      mockOpenSnapshotDatabases.mockResolvedValue({ ok: true, value: fakeHandles() });

      renderWeb();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Browse' })).toBeTruthy());
      fireEvent.press(screen.getByRole('button', { name: 'Browse' }));
      await waitFor(() => expect(screen.getByText('ready browseOnly:true')).toBeTruthy());
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockCheckAndApplyCurriculumUpdate).not.toHaveBeenCalled();
      expect(mockRequestPersistentStorage).not.toHaveBeenCalled();
      expect(mockServeOwnerTab).not.toHaveBeenCalled();
      expect(mockInitializeDatabases).not.toHaveBeenCalled();
    });

    it('web: shows not-responding screen when the snapshot times out', async () => {
      mockTryAcquireDbLock.mockResolvedValue(null);
      mockRequestSnapshot.mockResolvedValue(NOT_RESPONDING);

      renderWeb();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Browse' })).toBeTruthy());
      fireEvent.press(screen.getByRole('button', { name: 'Browse' }));

      await waitFor(() =>
        expect(screen.getByText('The other PakaPaka tab did not answer')).toBeTruthy(),
      );
      expect(screen.getByText('Open that tab once, then reload this page.')).toBeTruthy();
      expect(mockOpenSnapshotDatabases).not.toHaveBeenCalled();
      fireEvent.press(screen.getByRole('button', { name: 'Reload' }));
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('web: shows not-responding screen when the release times out', async () => {
      mockTryAcquireDbLock.mockResolvedValue(null);
      mockRequestSnapshot.mockReturnValue(new Promise(() => {}));
      mockUseHere.mockResolvedValue(NOT_RESPONDING);

      renderWeb();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Use here' })).toBeTruthy());
      fireEvent.press(screen.getByRole('button', { name: 'Use here' }));

      await waitFor(() =>
        expect(screen.getByText('The other PakaPaka tab did not answer')).toBeTruthy(),
      );
      expect(mockUseHere).toHaveBeenCalledWith(5000);
      expect(reload).not.toHaveBeenCalled();
    });

    it('web: Use here reloads after the lock is granted', async () => {
      mockTryAcquireDbLock.mockResolvedValue(null);
      mockRequestSnapshot.mockReturnValue(new Promise(() => {}));
      const granted = deferred<{ ok: true; value: undefined }>();
      mockUseHere.mockReturnValue(granted.promise);

      renderWeb();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Use here' })).toBeTruthy());
      fireEvent.press(screen.getByRole('button', { name: 'Use here' }));

      await waitFor(() => expect(screen.getByText('Moving PakaPaka to this tab…')).toBeTruthy());
      expect(reload).not.toHaveBeenCalled();

      await act(async () => {
        granted.resolve({ ok: true, value: undefined });
      });
      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    });

    it('web: Use here in a browse-only tab closes the copies before reload', async () => {
      const handles = fakeHandles();
      const order: string[] = [];
      handles.curriculumDb.closeAsync.mockImplementation(async () => order.push('close'));
      handles.userDb.closeAsync.mockImplementation(async () => order.push('close'));
      reload.mockImplementation(() => order.push('reload'));
      mockTryAcquireDbLock.mockResolvedValue(null);
      mockRequestSnapshot.mockResolvedValue({ ok: true, value: SNAPSHOT });
      mockOpenSnapshotDatabases.mockResolvedValue({ ok: true, value: handles });
      mockUseHere.mockResolvedValue({ ok: true, value: undefined });

      renderWeb(<UseHereProbe />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Browse' })).toBeTruthy());
      fireEvent.press(screen.getByRole('button', { name: 'Browse' }));
      await waitFor(() => expect(screen.getByText('use here from app')).toBeTruthy());
      fireEvent.press(screen.getByText('use here from app'));

      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
      expect(order).toEqual(['close', 'close', 'reload']);
      reload.mockReset();
    });

    it('owner release closes both handles before dropping the lock', async () => {
      const handles = fakeHandles();
      const order: string[] = [];
      const lease = { release: jest.fn(() => order.push('release lock')) };
      handles.curriculumDb.closeAsync.mockImplementation(async () => order.push('close curriculum'));
      handles.userDb.closeAsync.mockImplementation(async () => order.push('close user'));
      browser.dispatchEvent = jest.fn((event: Event) => order.push(`event ${event.type}`));
      mockTryAcquireDbLock.mockResolvedValue(lease);
      mockInitializeDatabases.mockResolvedValue({ ok: true, value: handles });
      const stopServing = jest.fn(() => order.push('stop serving'));
      mockServeOwnerTab.mockReturnValue(stopServing);

      renderWeb();
      await waitFor(() => expect(screen.getByText('ready browseOnly:false')).toBeTruthy());
      const { onRelease } = mockServeOwnerTab.mock.calls[0][0];
      await act(async () => {
        onRelease();
      });

      await waitFor(() => expect(lease.release).toHaveBeenCalledTimes(1));
      expect(order).toEqual([
        'stop serving',
        'close curriculum',
        'close user',
        'event expo-sqlite:stop-worker',
        'release lock',
      ]);
      expect(screen.queryByText(/ready browseOnly/)).toBeNull();
      expect(screen.getByText('PakaPaka is open in another tab')).toBeTruthy();
      expect(
        screen.getByText('You moved PakaPaka to another tab. Your answers up to now are saved.'),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Use here' })).toBeTruthy();
      expect(reload).not.toHaveBeenCalled();
    });

    it('native: never touches the lock or channel', async () => {
      setPlatform('ios');
      render(
        <DatabaseProvider>
          <ModeProbe />
        </DatabaseProvider>,
      );

      await waitFor(() => expect(screen.getByText('ready browseOnly:false')).toBeTruthy());
      expect(mockTryAcquireDbLock).not.toHaveBeenCalled();
      expect(mockServeOwnerTab).not.toHaveBeenCalled();
      expect(mockRequestSnapshot).not.toHaveBeenCalled();
    });
  });
});
