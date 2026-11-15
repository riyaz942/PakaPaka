import { createApiClient } from '@/core/account/apiClient';
import {
  createSessionManager,
  type StoredSession,
  type TokenStore,
} from '@/core/account/sessionManager';
import type { Result } from '@/types/result.types';

const NOW = 1_000_000_000;
const ok = <T,>(value: T): Result<T> => ({ ok: true, value });

function fakeStore(initial: StoredSession | null) {
  let session = initial;
  const store: TokenStore = {
    load: jest.fn(async () => ok(session)),
    save: jest.fn(async (s: StoredSession) => {
      session = s;
      return ok(undefined);
    }),
    clear: jest.fn(async () => {
      session = null;
      return ok(undefined);
    }),
  };
  return { store, current: () => session };
}

const session = (over: Partial<StoredSession> = {}): StoredSession => ({
  accessToken: 'at-old',
  accessExpiresAtMs: NOW + 10 * 60_000,
  refreshToken: 'rt-old',
  deviceId: 'dev-1',
  ...over,
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

function setup(initial: StoredSession | null, fetchFn: jest.Mock) {
  const { store, current } = fakeStore(initial);
  const api = createApiClient({ baseUrl: 'https://x.test', fetch: fetchFn });
  const manager = createSessionManager({ api, store, nowMs: () => NOW });
  return { manager, store, current };
}

const calls = (fetchFn: jest.Mock, path: string) =>
  fetchFn.mock.calls.filter(([url]) => String(url).endsWith(path));

describe('sessionManager', () => {
  it('uses a fresh token without refreshing', async () => {
    const fetchFn = jest.fn(async (_url: string, _init?: RequestInit) => json(200, {}));
    const { manager } = setup(session(), fetchFn);

    const res = await manager.authorizedRequest('/api/data', {});

    expect(res.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const init = fetchFn.mock.calls[0][1];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer at-old');
  });

  it('refreshes once for concurrent calls', async () => {
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/auth/refresh')) {
        expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: 'rt-old' });
        return json(200, { accessToken: 'at-new', refreshToken: 'rt-new' });
      }
      const auth = new Headers(init?.headers).get('Authorization');
      return auth === 'Bearer at-new' ? json(200, {}) : json(401, { error: 'unauthorized' });
    });
    const { manager, current } = setup(session({ accessExpiresAtMs: NOW + 10_000 }), fetchFn);

    const [a, b] = await Promise.all([
      manager.authorizedRequest('/api/a', {}),
      manager.authorizedRequest('/api/b', {}),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(calls(fetchFn, '/api/auth/refresh')).toHaveLength(1);
    expect(current()).toEqual({
      accessToken: 'at-new',
      accessExpiresAtMs: NOW + 15 * 60_000,
      refreshToken: 'rt-new',
      deviceId: 'dev-1',
    });
  });

  it('retries once after a 401 then gives up', async () => {
    const fetchFn = jest.fn(async (url: string) => {
      if (url.endsWith('/api/auth/refresh')) {
        return json(200, { accessToken: 'at-new', refreshToken: 'rt-new' });
      }
      return json(401, { error: 'unauthorized' });
    });
    const { manager } = setup(session(), fetchFn);

    const res = await manager.authorizedRequest('/api/data', {});

    expect(res).toMatchObject({ ok: false, error: { code: 'session_ended' } });
    expect(calls(fetchFn, '/api/data')).toHaveLength(2);
    expect(calls(fetchFn, '/api/auth/refresh')).toHaveLength(1);
  });

  it('refresh 401 ends the session once', async () => {
    const fetchFn = jest.fn(async () => json(401, { error: 'unauthorized' }));
    const { manager, store, current } = setup(
      session({ accessExpiresAtMs: NOW - 1 }),
      fetchFn,
    );

    const first = await manager.authorizedRequest('/api/data', {});
    expect(first).toMatchObject({ ok: false, error: { code: 'session_ended' } });
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(current()).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const second = await manager.authorizedRequest('/api/data', {});
    expect(second).toMatchObject({ ok: false, error: { code: 'session_ended' } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it('refresh failure other than 401 keeps the session', async () => {
    const fetchFn = jest.fn(async () => {
      throw new Error('offline');
    });
    const { manager, store, current } = setup(
      session({ accessExpiresAtMs: NOW - 1 }),
      fetchFn,
    );

    const res = await manager.authorizedRequest('/api/data', {});

    expect(res).toMatchObject({ ok: false, error: { code: 'network' } });
    expect(store.clear).not.toHaveBeenCalled();
    expect(current()).not.toBeNull();
  });

  it('signed out: no fetch', async () => {
    const fetchFn = jest.fn();
    const { manager } = setup(null, fetchFn);

    const res = await manager.authorizedRequest('/api/data', {});

    expect(res).toMatchObject({ ok: false, error: { code: 'session_ended' } });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
