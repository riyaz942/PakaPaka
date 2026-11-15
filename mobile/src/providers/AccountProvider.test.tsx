import { act, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform, Text } from 'react-native';

import type { AccountInfo, AccountSession } from '@/core/account/account.types';
import { accountError } from '@/core/account/apiClient';
import { createAccountSession as createWebSession } from '@/data/account/session.web';
import { AccountProvider, useAccount, type AccountContextValue } from '@/providers/AccountProvider';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { google: { webClientId: 'web-id', iosClientId: 'ios-id' } } } },
}));
jest.mock('expo-device', () => ({ __esModule: true, modelName: 'Pixel 9' }));

const setPlatform = (os: 'ios' | 'web') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

const INFO: AccountInfo = {
  provider: 'google',
  devices: [
    { deviceId: 'd1', label: 'Pixel 9', lastUsedAt: 1_700_000_000_000, current: true },
    { deviceId: 'd2', label: 'Chrome', lastUsedAt: 1_700_000_100_000, current: false },
  ],
};

const ok = async () => ({ ok: true as const, value: undefined });

function fakeSession(over: Partial<AccountSession> = {}): jest.Mocked<AccountSession> {
  return {
    isSignedIn: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(ok),
    getAccount: jest.fn().mockResolvedValue({ ok: true, value: INFO }),
    removeDevice: jest.fn(ok),
    signOut: jest.fn(ok),
    signOutEverywhere: jest.fn(ok),
    deleteAccount: jest.fn(ok),
    ...over,
  } as jest.Mocked<AccountSession>;
}

let latest: AccountContextValue;
function Probe() {
  latest = useAccount();
  return <Text testID="status">{latest.status}</Text>;
}

function renderWith(session?: AccountSession) {
  return render(
    <AccountProvider session={session}>
      <Probe />
    </AccountProvider>,
  );
}

let fetchSpy: jest.Mock;
beforeEach(() => {
  setPlatform('ios');
  fetchSpy = jest.fn();
  global.fetch = fetchSpy as unknown as typeof fetch;
});
afterEach(() => setPlatform('ios'));

describe('AccountProvider', () => {
  it('signed out: no fetch on mount (native)', async () => {
    renderWith();

    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signed_out'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('signed out: no fetch on mount (web)', async () => {
    setPlatform('web');
    Object.defineProperty(globalThis, 'document', { value: { cookie: '' }, configurable: true });
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: { href: 'http://localhost/settings', assign: jest.fn() },
        history: { state: null, replaceState: jest.fn() },
      },
      configurable: true,
    });

    renderWith(createWebSession());

    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signed_out'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('signed in: loads account', async () => {
    const session = fakeSession();

    renderWith(session);

    await waitFor(() => expect(latest.status).toBe('signed_in'));
    expect(latest.account).toEqual(INFO);
    expect(session.getAccount).toHaveBeenCalledTimes(1);
  });

  it('does not call getAccount when signed out', async () => {
    const session = fakeSession({ isSignedIn: jest.fn().mockResolvedValue(false) });

    renderWith(session);

    await waitFor(() => expect(latest.status).toBe('signed_out'));
    expect(session.getAccount).not.toHaveBeenCalled();
  });

  it('session_ended moves to signed_out with the message', async () => {
    const session = fakeSession({
      getAccount: jest.fn().mockResolvedValue({ ok: false, error: accountError('session_ended') }),
    });

    renderWith(session);

    await waitFor(() => expect(latest.status).toBe('signed_out'));
    expect(latest.error).toBe('You were signed out. Sign in again to sync.');
    expect(latest.account).toBeNull();
  });

  it('a network failure keeps the user signed in with the message', async () => {
    const session = fakeSession({
      getAccount: jest.fn().mockResolvedValue({ ok: false, error: accountError('network') }),
    });

    renderWith(session);

    await waitFor(() => expect(latest.error).toBe("Can't reach the server. Check your connection and try again."));
    expect(latest.status).toBe('signed_in');
  });

  it('web: reads ?signin=failed and clears it from the URL', async () => {
    setPlatform('web');
    const replaceState = jest.fn();
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: { href: 'http://localhost/settings?signin=failed&x=1#top' },
        history: { state: null, replaceState },
      },
      configurable: true,
    });

    renderWith(fakeSession({ isSignedIn: jest.fn().mockResolvedValue(false) }));

    await waitFor(() => expect(latest.signInResult).toBe('failed'));
    expect(latest.error).toBe('Sign-in did not finish. Try again.');
    expect(latest.status).toBe('signed_out');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/settings?x=1#top');
  });

  it('web: ?signin=cancelled shows no message', async () => {
    setPlatform('web');
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: { href: 'http://localhost/settings?signin=cancelled' },
        history: { state: null, replaceState: jest.fn() },
      },
      configurable: true,
    });

    renderWith(fakeSession({ isSignedIn: jest.fn().mockResolvedValue(false) }));

    await waitFor(() => expect(latest.signInResult).toBe('cancelled'));
    expect(latest.error).toBeNull();
  });

  it('native: signOut ends signed out even when the call fails', async () => {
    const session = fakeSession({
      signOut: jest.fn().mockResolvedValue({ ok: false, error: accountError('server') }),
    });
    renderWith(session);
    await waitFor(() => expect(latest.status).toBe('signed_in'));

    await act(async () => {
      await latest.signOut();
    });

    await waitFor(() => expect(latest.status).toBe('signed_out'));
    expect(latest.account).toBeNull();
  });

  it('web: a failed sign-out keeps the user signed in with the error', async () => {
    setPlatform('web');
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: { href: 'http://localhost/settings' },
        history: { state: null, replaceState: jest.fn() },
      },
      configurable: true,
    });
    const session = fakeSession({
      signOut: jest.fn().mockResolvedValue({ ok: false, error: accountError('network') }),
    });
    renderWith(session);
    await waitFor(() => expect(latest.status).toBe('signed_in'));

    await act(async () => {
      await latest.signOut();
    });

    expect(latest.status).toBe('signed_in');
    expect(latest.account).toEqual(INFO);
    expect(latest.error).toBe("Can't reach the server. Check your connection and try again.");
  });

  it('web: a sign-out that finds the session ended signs out with its message', async () => {
    setPlatform('web');
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: { href: 'http://localhost/settings' },
        history: { state: null, replaceState: jest.fn() },
      },
      configurable: true,
    });
    const session = fakeSession({
      signOut: jest.fn().mockResolvedValue({ ok: false, error: accountError('session_ended') }),
    });
    renderWith(session);
    await waitFor(() => expect(latest.status).toBe('signed_in'));

    await act(async () => {
      await latest.signOut();
    });

    expect(latest.status).toBe('signed_out');
    expect(latest.error).toBe('You were signed out. Sign in again to sync.');
  });

  it('deleteAccount success signs out; failure keeps the account and shows the error', async () => {
    const deleteAccount = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: accountError('paused') })
      .mockResolvedValueOnce({ ok: true, value: undefined });
    renderWith(fakeSession({ deleteAccount }));
    await waitFor(() => expect(latest.status).toBe('signed_in'));

    await act(async () => {
      await latest.deleteAccount();
    });
    await waitFor(() => expect(latest.error).toMatch(/Sync is paused/));
    expect(latest.status).toBe('signed_in');

    await act(async () => {
      await latest.deleteAccount();
    });
    await waitFor(() => expect(latest.status).toBe('signed_out'));
  });

  it('removeDevice of another device reloads the account', async () => {
    const session = fakeSession();
    renderWith(session);
    await waitFor(() => expect(latest.status).toBe('signed_in'));

    await act(async () => {
      await latest.removeDevice('d2');
    });

    expect(session.removeDevice).toHaveBeenCalledWith('d2');
    expect(session.getAccount).toHaveBeenCalledTimes(2);
  });

  it('removeDevice of this device signs out', async () => {
    renderWith(fakeSession());
    await waitFor(() => expect(latest.status).toBe('signed_in'));

    await act(async () => {
      await latest.removeDevice('d1');
    });

    await waitFor(() => expect(latest.status).toBe('signed_out'));
  });

  it('useAccount outside the provider throws a developer error', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAccount must be used within AccountProvider');
    spy.mockRestore();
  });
});
