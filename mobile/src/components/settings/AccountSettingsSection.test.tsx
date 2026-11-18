import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { accountErrorMessage } from '@/core/account/errorMessages';
import type { AccountContextValue } from '@/providers/AccountProvider';
import type { SyncContextValue } from '@/providers/SyncProvider';

import { AccountSettingsSection, DELETE_ACCOUNT_CONFIRM_COPY } from './AccountSettingsSection';

let mockAccount: AccountContextValue;
jest.mock('@/providers/AccountProvider', () => ({
  useAccount: () => mockAccount,
}));

let mockSync: SyncContextValue;
jest.mock('@/providers/SyncProvider', () => ({
  useSync: () => mockSync,
}));

function syncState(over: Partial<SyncContextValue> = {}): SyncContextValue {
  return {
    phase: 'idle',
    lastSyncedAt: null,
    error: null,
    conflicts: null,
    appliedVersion: 0,
    firstRun: 'none',
    syncNow: jest.fn().mockResolvedValue(undefined),
    retryFirstRun: jest.fn().mockResolvedValue(undefined),
    syncBeforeSignOut: jest.fn().mockResolvedValue(true),
    chooseConflict: jest.fn(),
    runBeforeReview: jest.fn().mockResolvedValue(undefined),
    beginStudy: jest.fn(),
    endStudy: jest.fn(),
    replaceRemoteAfterRestore: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

beforeEach(() => {
  mockSync = syncState();
});

function accountState(over: Partial<AccountContextValue> = {}): AccountContextValue {
  return {
    status: 'signed_out',
    account: null,
    error: null,
    signInResult: null,
    signIn: jest.fn().mockResolvedValue(undefined),
    refresh: jest.fn().mockResolvedValue(undefined),
    removeDevice: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn().mockResolvedValue(true),
    signOutEverywhere: jest.fn().mockResolvedValue(true),
    deleteAccount: jest.fn().mockResolvedValue(true),
    ...over,
  };
}

const signedIn = (over: Partial<AccountContextValue> = {}) =>
  accountState({
    status: 'signed_in',
    account: {
      provider: 'google',
      devices: [
        { deviceId: 'd1', label: 'Pixel 9', lastUsedAt: 1_700_000_000_000, current: true },
        { deviceId: 'd2', label: 'Chrome on Mac', lastUsedAt: 1_700_100_000_000, current: false },
      ],
    },
    ...over,
  });

/** Presses and lets the async action finish, so the busy state settles inside act. */
async function press(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(label));
  });
}

describe('AccountSettingsSection', () => {
  it('signed out shows only the sign-in button and caption', async () => {
    mockAccount = accountState();
    render(<AccountSettingsSection />);

    await press('Sign in to sync');

    expect(mockAccount.signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Account')).toBeTruthy();
    expect(
      screen.getByText('Optional. Keeps your progress the same on all your devices.'),
    ).toBeTruthy();
    expect(screen.queryByText('Sign out')).toBeNull();
    expect(screen.queryByText('Delete account')).toBeNull();
    expect(screen.queryByTestId('settings-account-error')).toBeNull();
  });

  it('signed in lists devices and marks this device', async () => {
    mockAccount = signedIn();
    render(<AccountSettingsSection />);

    expect(screen.getByText('Signed in with Google')).toBeTruthy();
    expect(screen.getByText('Pixel 9')).toBeTruthy();
    expect(screen.getByText('Chrome on Mac')).toBeTruthy();
    expect(screen.getByTestId('settings-account-device-current-d1')).toBeTruthy();
    expect(screen.queryByTestId('settings-account-device-current-d2')).toBeNull();
    expect(screen.getAllByText(/Last used /)).toHaveLength(2);
  });

  it('Remove calls removeDevice with that id', async () => {
    mockAccount = signedIn();
    render(<AccountSettingsSection />);

    await press('Remove Chrome on Mac');

    expect(mockAccount.removeDevice).toHaveBeenCalledWith('d2');
  });

  it('Sync now calls syncNow', async () => {
    mockAccount = signedIn();
    render(<AccountSettingsSection />);

    await press('Sync now');

    expect(mockSync.syncNow).toHaveBeenCalledTimes(1);
  });

  it('Sync now is disabled while syncing and the caption is "Syncing…"', () => {
    mockAccount = signedIn();
    mockSync = syncState({ phase: 'syncing' });
    render(<AccountSettingsSection />);

    expect(screen.getByLabelText('Sync now').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByText('Syncing…')).toBeTruthy();
  });

  it('caption shows "Not synced yet." with no sync time', () => {
    mockAccount = signedIn();
    render(<AccountSettingsSection />);

    expect(screen.getByText('Not synced yet.')).toBeTruthy();
  });

  it('caption shows the last sync time', () => {
    const iso = '2026-11-10T09:30:00.000Z';
    mockAccount = signedIn();
    mockSync = syncState({ lastSyncedAt: iso });
    render(<AccountSettingsSection />);

    expect(screen.getByText(`Last synced ${new Date(iso).toLocaleString()}`)).toBeTruthy();
  });

  it('sync error shows under the button', () => {
    mockAccount = signedIn();
    mockSync = syncState({ error: 'Sync did not finish. It runs again the next time.' });
    render(<AccountSettingsSection />);

    expect(screen.getByTestId('settings-account-sync-error')).toHaveTextContent(
      'Sync did not finish. It runs again the next time.',
    );
  });

  it('signed out renders no sync row', () => {
    mockAccount = accountState();
    render(<AccountSettingsSection />);

    expect(screen.queryByTestId('settings-account-sync')).toBeNull();
    expect(screen.queryByTestId('settings-account-sync-error')).toBeNull();
  });

  it('Sign out asks first and does nothing until the user picks', async () => {
    mockAccount = signedIn();
    render(<AccountSettingsSection />);

    await press('Sign out');

    expect(mockAccount.signOut).not.toHaveBeenCalled();
    expect(screen.getByText('Sign out?')).toBeTruthy();
    expect(screen.getByText(/Your progress syncs first/)).toBeTruthy();

    await press('Cancel');

    expect(mockAccount.signOut).not.toHaveBeenCalled();
    expect(screen.queryByText('Sign out?')).toBeNull();
  });

  it('Sign out syncs first, then signs out, then erases', async () => {
    const calls: string[] = [];
    mockAccount = signedIn({
      signOut: jest.fn().mockImplementation(async () => {
        calls.push('signOut');
        return true;
      }),
    });
    mockSync = syncState({
      syncBeforeSignOut: jest.fn().mockImplementation(async () => {
        calls.push('syncBeforeSignOut');
        return true;
      }),
    });
    const onErase = jest.fn().mockImplementation(() => calls.push('onErase'));
    render(<AccountSettingsSection onEraseLocalData={onErase} />);

    await press('Sign out');
    await press('Sync and sign out');

    expect(calls).toEqual(['syncBeforeSignOut', 'signOut', 'onErase']);
    expect(mockAccount.signOutEverywhere).not.toHaveBeenCalled();
  });

  it('a failed sync shows the sync-failed step and never signs out or erases', async () => {
    mockAccount = signedIn();
    mockSync = syncState({
      error: 'No connection.',
      syncBeforeSignOut: jest.fn().mockResolvedValue(false),
    });
    const onErase = jest.fn();
    render(<AccountSettingsSection onEraseLocalData={onErase} />);

    await press('Sign out');
    await press('Sync and sign out');

    expect(screen.getByText('Sync did not finish')).toBeTruthy();
    expect(
      screen.getByText('No connection. If you erase now, progress that is not synced yet is lost.'),
    ).toBeTruthy();
    expect(mockAccount.signOut).not.toHaveBeenCalled();
    expect(onErase).not.toHaveBeenCalled();
  });

  it('Try again syncs again and signs out on success', async () => {
    mockAccount = signedIn();
    mockSync = syncState({
      syncBeforeSignOut: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
    });
    const onErase = jest.fn();
    render(<AccountSettingsSection onEraseLocalData={onErase} />);

    await press('Sign out');
    await press('Sync and sign out');
    expect(mockAccount.signOut).not.toHaveBeenCalled();

    await press('Try again');

    expect(mockSync.syncBeforeSignOut).toHaveBeenCalledTimes(2);
    expect(mockAccount.signOut).toHaveBeenCalledTimes(1);
    expect(onErase).toHaveBeenCalledTimes(1);
  });

  it('Erase anyway signs out and erases without a sync', async () => {
    mockAccount = signedIn();
    mockSync = syncState({ syncBeforeSignOut: jest.fn().mockResolvedValue(false) });
    const onErase = jest.fn();
    render(<AccountSettingsSection onEraseLocalData={onErase} />);

    await press('Sign out');
    await press('Sync and sign out');
    await press('Erase anyway');

    expect(mockSync.syncBeforeSignOut).toHaveBeenCalledTimes(1);
    expect(mockAccount.signOut).toHaveBeenCalledTimes(1);
    expect(onErase).toHaveBeenCalledTimes(1);
  });

  it('a failed sign-out never erases', async () => {
    mockAccount = signedIn({ signOut: jest.fn().mockResolvedValue(false) });
    const onErase = jest.fn();
    render(<AccountSettingsSection onEraseLocalData={onErase} />);

    await press('Sign out');
    await press('Sync and sign out');

    expect(mockSync.syncBeforeSignOut).toHaveBeenCalledTimes(1);
    expect(mockAccount.signOut).toHaveBeenCalledTimes(1);
    expect(onErase).not.toHaveBeenCalled();
  });

  it('Sign out everywhere syncs first, then erases', async () => {
    const calls: string[] = [];
    mockAccount = signedIn({
      signOutEverywhere: jest.fn().mockImplementation(async () => {
        calls.push('signOutEverywhere');
        return true;
      }),
    });
    mockSync = syncState({
      syncBeforeSignOut: jest.fn().mockImplementation(async () => {
        calls.push('syncBeforeSignOut');
        return true;
      }),
    });
    const onErase = jest.fn().mockImplementation(() => calls.push('onErase'));
    render(<AccountSettingsSection onEraseLocalData={onErase} />);

    await press('Sign out everywhere');
    expect(screen.getByText('Sign out everywhere?')).toBeTruthy();
    await press('Sync and sign out');

    expect(calls).toEqual(['syncBeforeSignOut', 'signOutEverywhere', 'onErase']);
    expect(mockAccount.signOut).not.toHaveBeenCalled();
  });

  it('Cancel signs nothing out and erases nothing', async () => {
    mockAccount = signedIn();
    mockSync = syncState({ syncBeforeSignOut: jest.fn().mockResolvedValue(false) });
    const onErase = jest.fn();
    render(<AccountSettingsSection onEraseLocalData={onErase} />);

    await press('Sign out');
    await press('Cancel');

    expect(screen.queryByText('Sign out?')).toBeNull();

    await press('Sign out');
    await press('Sync and sign out');
    expect(screen.getByText('Sync did not finish')).toBeTruthy();
    await press('Cancel');
    await press('Sign out');

    // Cancel resets the sheet to the confirm step.
    expect(screen.getByText('Sign out?')).toBeTruthy();
    expect(mockSync.syncBeforeSignOut).toHaveBeenCalledTimes(1);
    expect(mockAccount.signOut).not.toHaveBeenCalled();
    expect(onErase).not.toHaveBeenCalled();
  });

  it('a sign-out the server ends never erases', async () => {
    mockAccount = signedIn();
    const onErase = jest.fn();
    const view = render(<AccountSettingsSection onEraseLocalData={onErase} />);

    mockAccount = accountState({
      status: 'signed_out',
      error: 'You were signed out. Sign in again to sync.',
    });
    view.rerender(<AccountSettingsSection onEraseLocalData={onErase} />);

    expect(screen.getByTestId('settings-account-error')).toHaveTextContent(
      'You were signed out. Sign in again to sync.',
    );
    expect(onErase).not.toHaveBeenCalled();
  });

  it('Delete account asks first, with the exact copy', async () => {
    mockAccount = signedIn();
    render(<AccountSettingsSection />);

    await press('Delete account');

    expect(mockAccount.deleteAccount).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'This deletes your account and your progress on our server. All your devices are signed out, and this device is erased. This cannot be undone.',
      ),
    ).toBeTruthy();
    expect(DELETE_ACCOUNT_CONFIRM_COPY).toContain('this device is erased');

    await press('Delete account');

    expect(mockAccount.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('Delete account erases this device after the server delete worked', async () => {
    mockAccount = signedIn();
    const onErase = jest.fn();
    render(<AccountSettingsSection onEraseLocalData={onErase} />);

    await press('Delete account');
    await press('Delete account');

    expect(mockAccount.deleteAccount).toHaveBeenCalledTimes(1);
    expect(mockSync.syncBeforeSignOut).not.toHaveBeenCalled();
    expect(onErase).toHaveBeenCalledTimes(1);
  });

  it('a failed Delete account never erases', async () => {
    mockAccount = signedIn({ deleteAccount: jest.fn().mockResolvedValue(false) });
    const onErase = jest.fn();
    render(<AccountSettingsSection onEraseLocalData={onErase} />);

    await press('Delete account');
    await press('Delete account');

    expect(mockAccount.deleteAccount).toHaveBeenCalledTimes(1);
    expect(onErase).not.toHaveBeenCalled();
  });

  it('Remove on this device opens the sign-out sheet and calls no removeDevice', async () => {
    mockAccount = signedIn();
    render(<AccountSettingsSection />);

    await press('Remove Pixel 9');

    expect(mockAccount.removeDevice).not.toHaveBeenCalled();
    expect(screen.getByText('Sign out?')).toBeTruthy();
    expect(screen.queryByText('Sign out everywhere?')).toBeNull();

    await press('Sync and sign out');

    expect(mockAccount.signOut).toHaveBeenCalledTimes(1);
    expect(mockAccount.removeDevice).not.toHaveBeenCalled();
  });

  it('Cancel closes the confirm without deleting', async () => {
    mockAccount = signedIn();
    render(<AccountSettingsSection />);

    await press('Delete account');
    await press('Cancel');

    expect(screen.queryByTestId('settings-account-delete-confirm')).toBeNull();
    expect(mockAccount.deleteAccount).not.toHaveBeenCalled();
  });

  it('paused error shows the paused copy', async () => {
    mockAccount = signedIn({ error: accountErrorMessage('paused') });
    render(<AccountSettingsSection />);

    expect(screen.getByTestId('settings-account-error').props.children).toBe(
      'Sync is paused until tomorrow — your progress is safe on this device.',
    );
  });

  it('signed out shows a sign-in error', async () => {
    mockAccount = accountState({ error: 'Sign-in did not finish. Try again.' });
    render(<AccountSettingsSection />);

    expect(screen.getByText('Sign-in did not finish. Try again.')).toBeTruthy();
  });
});
