import type { ApiClient, ApiRequestInit } from '@/core/account/apiClient';
import { accountErrorMessage } from '@/core/account/errorMessages';
import type { AppError, Result } from '@/types/result.types';

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

const ACCESS_TTL_MS = 15 * 60_000;
const REFRESH_SKEW_MS = 30_000;

function failure(code: 'session_ended' | 'server', cause?: unknown): { ok: false; error: AppError } {
  return {
    ok: false,
    error: {
      code,
      message: `Account request failed: ${code}`,
      userMessage: accountErrorMessage(code) ?? undefined,
      cause,
    },
  };
}

export function createSessionManager(deps: {
  api: ApiClient;
  store: TokenStore;
  nowMs: () => number;
}): SessionManager {
  const { api, store, nowMs } = deps;
  let inFlight: Promise<Result<void>> | null = null;

  async function doRefresh(): Promise<Result<void>> {
    const loaded = await store.load();
    if (!loaded.ok) return loaded;
    const current = loaded.value;
    if (current === null) return failure('session_ended');

    const res = await api.request('/api/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    if (!res.ok) {
      if (res.error.code === 'session_ended') {
        const cleared = await store.clear();
        if (!cleared.ok) return cleared;
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

  async function loadSession(): Promise<Result<StoredSession>> {
    const loaded = await store.load();
    if (!loaded.ok) return loaded;
    if (loaded.value === null) return failure('session_ended');
    return { ok: true, value: loaded.value };
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
    return api.request(path, { ...init, accessToken: latest.value.accessToken });
  }

  return { authorizedRequest, refreshNow };
}
