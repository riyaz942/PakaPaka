import type { AccountErrorCode } from '@/core/account/account.types';
import { accountError, type ApiClient, type ApiRequestInit } from '@/core/account/apiClient';
import type { Result } from '@/types/result.types';

export type StoredSession = {
  accessToken: string;
  accessExpiresAtMs: number;
  refreshToken: string;
  deviceId: string;
};

export type TokenStore = {
  load(): Promise<Result<StoredSession | null>>;
  save(s: StoredSession): Promise<Result<void>>;
  clear(): Promise<Result<void>>;
};

export type SessionManager = {
  authorizedRequest(path: string, init: ApiRequestInit): Promise<Result<Response>>;
  refreshNow(): Promise<Result<void>>;
};

export const ACCESS_TTL_MS = 15 * 60_000;
const REFRESH_SKEW_MS = 30_000;

function failure(code: AccountErrorCode, cause?: unknown): Result<never> {
  return { ok: false, error: accountError(code, cause) };
}

export function createSessionManager(deps: {
  api: ApiClient;
  store: TokenStore;
  nowMs: () => number;
}): SessionManager {
  const { api, store, nowMs } = deps;
  let inFlight: Promise<Result<void>> | null = null;
  // Refresh token whose refresh got a 401. A session still holding it is over,
  // even if clearing the store failed. A different token means a new sign-in.
  let endedRefreshToken: string | null = null;

  async function loadSession(): Promise<Result<StoredSession>> {
    const loaded = await store.load();
    if (!loaded.ok) return loaded;
    const current = loaded.value;
    if (current === null) return failure('session_ended');
    if (current.refreshToken === endedRefreshToken) return failure('session_ended');
    endedRefreshToken = null;
    return { ok: true, value: current };
  }

  async function doRefresh(): Promise<Result<void>> {
    const loaded = await loadSession();
    if (!loaded.ok) return loaded;
    const current = loaded.value;

    const res = await api.request('/api/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    if (!res.ok) {
      if (res.error.code === 'session_ended') {
        endedRefreshToken = current.refreshToken;
        await store.clear();
      }
      return res;
    }

    const body: unknown = await res.value.json().catch(() => null);
    const tokens = body as { accessToken?: unknown; refreshToken?: unknown } | null;
    if (typeof tokens?.accessToken !== 'string' || typeof tokens.refreshToken !== 'string') {
      return failure('server');
    }

    return store.save({
      accessToken: tokens.accessToken,
      accessExpiresAtMs: nowMs() + ACCESS_TTL_MS,
      refreshToken: tokens.refreshToken,
      deviceId: current.deviceId,
    });
  }

  function refreshNow(): Promise<Result<void>> {
    if (inFlight === null) {
      inFlight = doRefresh().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  async function authorizedRequest(
    path: string,
    init: ApiRequestInit,
  ): Promise<Result<Response>> {
    let session = await loadSession();
    if (!session.ok) return session;

    if (session.value.accessExpiresAtMs - REFRESH_SKEW_MS < nowMs()) {
      const refreshed = await refreshNow();
      if (!refreshed.ok) return refreshed;
      session = await loadSession();
      if (!session.ok) return session;
    }

    const usedToken = session.value.accessToken;
    const first = await api.request(path, { ...init, accessToken: usedToken });
    if (first.ok || first.error.code !== 'session_ended') return first;

    // One retry after a 401. If another call already rotated the token, reuse it
    // instead of refreshing again.
    let latest = await loadSession();
    if (!latest.ok) return latest;
    if (latest.value.accessToken === usedToken) {
      const refreshed = await refreshNow();
      if (!refreshed.ok) return refreshed;
      latest = await loadSession();
      if (!latest.ok) return latest;
    }
    const retried = await api.request(path, { ...init, accessToken: latest.value.accessToken });
    // A 401 with a token that was just refreshed is not a sign-out.
    if (!retried.ok && retried.error.code === 'session_ended') {
      return failure('server', retried.error);
    }
    return retried;
  }

  return { authorizedRequest, refreshNow };
}
