import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { leaveAfterErase } from '@/components/settings/leaveAfterErase';
import { SessionEndedHost } from '@/components/sync/SessionEndedHost';
import { eraseLocalData } from '@/data/user/restoreBackup';

let mockSessionEnd: 'none' | 'erase' | 'ask' = 'none';
jest.mock('@/providers/SyncProvider', () => ({
  useSync: () => ({ sessionEnd: mockSessionEnd }),
}));

const mockSignIn = jest.fn(async () => undefined);
let mockAccountError: string | null = null;
jest.mock('@/providers/AccountProvider', () => ({
  useAccount: () => ({ signIn: mockSignIn, error: mockAccountError }),
}));

const mockUserDb = { name: 'user.db' };
jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: mockUserDb }),
}));

jest.mock('@/data/user/restoreBackup', () => ({ eraseLocalData: jest.fn() }));
jest.mock('@/components/settings/leaveAfterErase', () => ({ leaveAfterErase: jest.fn() }));

const SIGNED_OUT = 'You were signed out. Sign in again to sync.';

beforeEach(() => {
  jest.clearAllMocks();
  mockSessionEnd = 'none';
  mockAccountError = null;
  jest.mocked(eraseLocalData).mockReturnValue({ ok: true, value: undefined });
});

describe('SessionEndedHost', () => {
  it('none renders nothing', () => {
    render(<SessionEndedHost />);

    expect(screen.queryByTestId('session-ended')).toBeNull();
    expect(eraseLocalData).not.toHaveBeenCalled();
    expect(leaveAfterErase).not.toHaveBeenCalled();
  });

  it('erase erases and leaves without a question', () => {
    mockSessionEnd = 'erase';
    const view = render(<SessionEndedHost />);
    view.rerender(<SessionEndedHost />);

    expect(eraseLocalData).toHaveBeenCalledTimes(1);
    expect(eraseLocalData).toHaveBeenCalledWith(mockUserDb);
    expect(leaveAfterErase).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('session-ended')).toBeNull();
  });

  it('ask shows the screen and erases nothing until a press', () => {
    mockSessionEnd = 'ask';
    mockAccountError = SIGNED_OUT;
    render(<SessionEndedHost />);

    expect(screen.getByTestId('session-ended')).toBeTruthy();
    expect(screen.getByText('You were signed out')).toBeTruthy();
    expect(
      screen.getByText(
        'This device has progress that is not synced yet. Sign in again to sync it, or erase it from this device.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Sign in to sync it')).toBeTruthy();
    expect(screen.getByText('Erase anyway')).toBeTruthy();
    expect(screen.getByText(SIGNED_OUT)).toBeTruthy();
    expect(eraseLocalData).not.toHaveBeenCalled();
    expect(leaveAfterErase).not.toHaveBeenCalled();
  });

  it('Erase anyway erases and leaves', () => {
    mockSessionEnd = 'ask';
    render(<SessionEndedHost />);

    fireEvent.press(screen.getByText('Erase anyway'));

    expect(eraseLocalData).toHaveBeenCalledWith(mockUserDb);
    expect(leaveAfterErase).toHaveBeenCalledTimes(1);
  });

  it('Sign in to sync it calls signIn', () => {
    mockSessionEnd = 'ask';
    render(<SessionEndedHost />);

    fireEvent.press(screen.getByText('Sign in to sync it'));

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(eraseLocalData).not.toHaveBeenCalled();
  });

  it('a failed erase shows the ask screen with the error', () => {
    mockSessionEnd = 'erase';
    jest.mocked(eraseLocalData).mockReturnValue({
      ok: false,
      error: { code: 'LOCAL_ERASE_FAILED', message: 'disk', userMessage: 'Could not erase.' },
    });
    render(<SessionEndedHost />);

    expect(eraseLocalData).toHaveBeenCalledTimes(1);
    expect(leaveAfterErase).not.toHaveBeenCalled();
    expect(screen.getByTestId('session-ended')).toBeTruthy();
    expect(screen.getByText('Could not erase.')).toBeTruthy();
    expect(screen.getByText('Erase anyway')).toBeTruthy();
  });
});
