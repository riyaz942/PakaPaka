import { render, screen, waitFor } from '@testing-library/react-native';
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

describe('DatabaseProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('skips the curriculum update on web', async () => {
    setPlatform('web');
    render(
      <DatabaseProvider>
        <Text>ready</Text>
      </DatabaseProvider>,
    );
    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy());
    expect(mockCheckAndApplyCurriculumUpdate).not.toHaveBeenCalled();
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
