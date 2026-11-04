import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform, Text } from 'react-native';

import { DatabaseProvider } from '@/providers/DatabaseProvider';

const mockInitializeDatabases = jest.fn();
const mockCheckAndApplyCurriculumUpdate = jest.fn();

jest.mock('@/data/database', () => ({
  initializeDatabases: () => mockInitializeDatabases(),
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
});
