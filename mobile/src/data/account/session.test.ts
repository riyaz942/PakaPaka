import * as SecureStore from 'expo-secure-store';
import { GoogleOneTapSignIn } from 'react-native-nitro-google-signin';

import { ACCESS_TTL_MS, type StoredSession } from '@/core/account/sessionManager';
import { createAccountSession } from '@/data/account/session';
import { secureTokenStore } from '@/data/account/tokenStore';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { google: { webClientId: 'web-id', iosClientId: 'ios-id' } } } },
}));
jest.mock('expo-device', () => ({ __esModule: true, modelName: 'Pixel 9' }));

const configure = GoogleOneTapSignIn.configure as jest.Mock;
const createAccount = GoogleOneTapSignIn.createAccount as jest.Mock;
const libSignOut = GoogleOneTapSignIn.signOut as jest.Mock;

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

const BASE = 'https://paka-paka.app';

let fetchMock: jest.Mock;
const calls = (path: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url) === `${BASE}${path}`);

const session = (over: Partial<StoredSession> = {}): StoredSession => ({
  accessToken: 'at',
  accessExpiresAtMs: Date.now() + 10 * 60_000,
  refreshToken: 'rt-default',
  deviceId: 'dev-1',
  ...over,
});

async function seed(s: StoredSession) {
  await secureTokenStore.save(s);
}

const storedNow = async () => {
  const loaded = await secureTokenStore.load();
  return loaded.ok ? loaded.value : 'load failed';
};

function respondToSignIn() {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith('/api/auth/nonce')) return json(200, { nonce: 'server-nonce' });
    if (url.endsWith('/api/auth/exchange')) {
      return json(200, {
        accessToken: 'new-at',
        refreshToken: 'new-rt',
        deviceId: 'dev-new',
        provider: 'google',
      });
    }
    return json(404, { error: 'not_found' });
  });
}

beforeEach(async () => {
  await SecureStore.deleteItemAsync('account_session_v1');
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  configure.mockReset();
  createAccount.mockReset().mockResolvedValue({
    type: 'success',
    data: { idToken: 'google-id-token', user: {}, scopes: [] },
  });
  libSignOut.mockReset().mockResolvedValue(undefined);
});

describe('createAccountSession', () => {
  it('signIn stores the session from exchange', async () => {
    respondToSignIn();
    const before = Date.now();

    const result = await createAccountSession().signIn();

    expect(result.ok).toBe(true);
    const saved = (await storedNow()) as StoredSession;
    expect(saved).toMatchObject({
      accessToken: 'new-at',
      refreshToken: 'new-rt',
      deviceId: 'dev-new',
    });
    expect(saved.accessExpiresAtMs).toBeGreaterThanOrEqual(before + ACCESS_TTL_MS);
    const [, init] = calls('/api/auth/exchange')[0];
    expect(JSON.parse(init.body)).toEqual({
      provider: 'google',
      idToken: 'google-id-token',
      nonce: 'server-nonce',
      deviceLabel: 'Pixel 9',
    });
  });

  it('signIn passes the server nonce to configure', async () => {
    respondToSignIn();

    await createAccountSession().signIn();

    expect(configure).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'server-nonce' }));
  });

  it('library signOut is called after a successful sign-in', async () => {
    respondToSignIn();

    await createAccountSession().signIn();

    expect(libSignOut).toHaveBeenCalledTimes(1);
  });

  it('cancelled sign-in stores nothing and returns cancelled', async () => {
    respondToSignIn();
    createAccount.mockResolvedValue({ type: 'cancelled', data: null });

    const result = await createAccountSession().signIn();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cancelled');
    expect(await storedNow()).toBeNull();
    expect(calls('/api/auth/exchange')).toHaveLength(0);
  });

  it('a rejected exchange is a server error, not a sign-out message', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/api/auth/nonce')
        ? json(200, { nonce: 'server-nonce' })
        : json(401, { error: 'invalid_token' }),
    );

    const result = await createAccountSession().signIn();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('server');
    expect(await storedNow()).toBeNull();
  });

  it('isSignedIn false with an empty store makes no fetch', async () => {
    expect(await createAccountSession().isSignedIn()).toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('isSignedIn is true with a stored session', async () => {
    await seed(session());

    expect(await createAccountSession().isSignedIn()).toBe(true);
  });

  it('signOut clears the store even when the server call fails', async () => {
    await seed(session({ refreshToken: 'rt-signout' }));
    fetchMock.mockResolvedValue(json(500, { error: 'server_error' }));

    const result = await createAccountSession().signOut();

    expect(result.ok).toBe(true);
    expect(calls('/api/auth/signout')).toHaveLength(1);
    expect(await storedNow()).toBeNull();
  });

  it('signOut clears the store when the network is down', async () => {
    await seed(session({ refreshToken: 'rt-signout-offline' }));
    fetchMock.mockRejectedValue(new TypeError('offline'));

    const result = await createAccountSession().signOut();

    expect(result.ok).toBe(true);
    expect(await storedNow()).toBeNull();
  });

  it('deleteAccount clears the store on success and keeps it on failure', async () => {
    await seed(session({ refreshToken: 'rt-delete' }));
    fetchMock.mockResolvedValueOnce(json(500, { error: 'server_error' }));

    const failed = await createAccountSession().deleteAccount();

    expect(failed.ok).toBe(false);
    expect(await storedNow()).not.toBeNull();

    fetchMock.mockResolvedValueOnce(json(204));
    const done = await createAccountSession().deleteAccount();

    expect(done.ok).toBe(true);
    expect(calls('/api/account').map(([, init]) => init.method)).toEqual(['DELETE', 'DELETE']);
    expect(await storedNow()).toBeNull();
  });

  it('signOutEverywhere clears the store on success and keeps it on failure', async () => {
    await seed(session({ refreshToken: 'rt-all' }));
    fetchMock.mockResolvedValueOnce(json(500, { error: 'server_error' }));

    expect((await createAccountSession().signOutEverywhere()).ok).toBe(false);
    expect(await storedNow()).not.toBeNull();

    fetchMock.mockResolvedValueOnce(json(204));
    expect((await createAccountSession().signOutEverywhere()).ok).toBe(true);
    expect(calls('/api/account/signout-all')).toHaveLength(2);
    expect(await storedNow()).toBeNull();
  });

  it('getAccount returns the account from the server', async () => {
    await seed(session({ refreshToken: 'rt-account' }));
    const account = {
      provider: 'google',
      devices: [{ deviceId: 'dev-1', label: 'Pixel 9', lastUsedAt: 5, current: true }],
    };
    fetchMock.mockResolvedValue(json(200, account));

    const result = await createAccountSession().getAccount();

    expect(result).toEqual({ ok: true, value: account });
    const [, init] = calls('/api/account')[0];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer at');
  });

  it('session.request uses the session manager (native)', async () => {
    await seed(session({ refreshToken: 'rt-request' }));
    fetchMock.mockResolvedValue(json(200, { revision: 3 }));

    const result = await createAccountSession().request('/api/sync?have=1', { method: 'GET' });

    expect(result.ok).toBe(true);
    const [, init] = calls('/api/sync?have=1')[0];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer at');
    expect(init.method).toBe('GET');
  });

  it('removeDevice deletes another device on the server and keeps the session', async () => {
    await seed(session({ refreshToken: 'rt-remove' }));
    fetchMock.mockResolvedValue(json(204));

    const result = await createAccountSession().removeDevice('dev-2');

    expect(result.ok).toBe(true);
    const [, init] = calls('/api/account/devices/dev-2')[0];
    expect(init.method).toBe('DELETE');
    expect(await storedNow()).not.toBeNull();
  });

  it('removing the current device is a sign-out', async () => {
    await seed(session({ refreshToken: 'rt-remove-self', deviceId: 'dev-self' }));
    fetchMock.mockResolvedValue(json(204));

    const result = await createAccountSession().removeDevice('dev-self');

    expect(result.ok).toBe(true);
    expect(calls('/api/auth/signout')).toHaveLength(1);
    expect(calls('/api/account/devices/dev-self')).toHaveLength(0);
    expect(await storedNow()).toBeNull();
  });

  it('shares one refresh between sessions made by separate createAccountSession calls', async () => {
    await seed(
      session({
        refreshToken: 'rt-shared',
        accessExpiresAtMs: Date.now() - 1000,
      }),
    );
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/auth/refresh')) {
        await new Promise((r) => setTimeout(r, 10));
        return json(200, { accessToken: 'at-2', refreshToken: 'rt-shared-2' });
      }
      return json(200, { provider: 'google', devices: [] });
    });

    const [a, b] = await Promise.all([
      createAccountSession().getAccount(),
      createAccountSession().getAccount(),
    ]);

    expect(a.ok && b.ok).toBe(true);
    expect(calls('/api/auth/refresh')).toHaveLength(1);
  });
});
