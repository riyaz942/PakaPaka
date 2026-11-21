import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform, Text } from 'react-native';

import { DatabaseProvider } from '@/providers/DatabaseProvider';

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
    browser.location = { reload };
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
});
