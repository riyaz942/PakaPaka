import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { accountErrorMessage } from '@/core/account/errorMessages';
import type { AccountContextValue } from '@/providers/AccountProvider';

import { AccountSettingsSection, DELETE_ACCOUNT_CONFIRM_COPY } from './AccountSettingsSection';

let mockAccount: AccountContextValue;
jest.mock('@/providers/AccountProvider', () => ({
  useAccount: () => mockAccount,
}));

function accountState(over: Partial<AccountContextValue> = {}): AccountContextValue {
  return {
    status: 'signed_out',
    account: null,
    error: null,
    signInResult: null,
    signIn: jest.fn().mockResolvedValue(undefined),
    refresh: jest.fn().mockResolvedValue(undefined),
    removeDevice: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn().mockResolvedValue(undefined),
    signOutEverywhere: jest.fn().mockResolvedValue(undefined),
    deleteAccount: jest.fn().mockResolvedValue(undefined),
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

  it('Sync now is disabled with the caption', async () => {
    mockAccount = signedIn();
    render(<AccountSettingsSection />);

    expect(screen.getByLabelText('Sync now').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByText('Sync arrives in a later update.')).toBeTruthy();
  });

  it('Sign out and Sign out everywhere call the account actions', async () => {
    mockAccount = signedIn();
    render(<AccountSettingsSection />);

    await press('Sign out');
    await press('Sign out everywhere');

    expect(mockAccount.signOut).toHaveBeenCalledTimes(1);
    expect(mockAccount.signOutEverywhere).toHaveBeenCalledTimes(1);
  });

  it('Delete account asks first, with the exact copy', async () => {
    mockAccount = signedIn();
    render(<AccountSettingsSection />);

    await press('Delete account');

    expect(mockAccount.deleteAccount).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'This deletes your account and its data on the server. Your progress on this device stays.',
      ),
    ).toBeTruthy();
    expect(DELETE_ACCOUNT_CONFIRM_COPY).toContain('Your progress on this device stays.');

    await press('Delete account');

    expect(mockAccount.deleteAccount).toHaveBeenCalledTimes(1);
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
