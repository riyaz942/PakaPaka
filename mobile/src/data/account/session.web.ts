import type { AccountInfo, AccountSession } from '@/core/account/account.types';
import { accountError, createApiClient, type ApiRequestInit } from '@/core/account/apiClient';
import type { Result } from '@/types/result.types';

const ok = (): Result<void> => ({ ok: true, value: undefined });
const serverError = (cause?: unknown): Result<never> => ({
  ok: false,
  error: accountError('server', cause),
});

// Relative URLs: the browser sends the session cookies to the same origin.
const api = createApiClient({
  baseUrl: '',
  fetch: (input, init) => globalThis.fetch(input, init),
});

// One refresh at a time: the server rotates the refresh cookie, so two parallel
// refreshes would look like token reuse and end the session.
let refreshing: Promise<Result<void>> | null = null;

function refreshOnce(): Promise<Result<void>> {
  if (refreshing === null) {
    refreshing = api
      .request('/api/auth/refresh', { method: 'POST' })
      .then((res): Result<void> => (res.ok ? ok() : res))
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/** On a 401, refresh once and retry once. A 401 from the refresh ends the session. */
async function authorized(path: string, init: ApiRequestInit): Promise<Result<Response>> {
  const first = await api.request(path, init);
  if (first.ok || first.error.code !== 'session_ended') return first;

  const refreshed = await refreshOnce();
  if (!refreshed.ok) return refreshed;

  const retried = await api.request(path, init);
  // A 401 right after a successful refresh is not a sign-out.
  if (!retried.ok && retried.error.code === 'session_ended') {
    return { ok: false, error: accountError('server', retried.error) };
  }
  return retried;
}

async function send(path: string, init: ApiRequestInit): Promise<Result<void>> {
  const res = await authorized(path, init);
  return res.ok ? ok() : res;
}

export function createAccountSession(): AccountSession {
  return {
    async isSignedIn() {
      return document.cookie.split('; ').includes('pp_signed_in=1');
    },

    async signIn() {
      window.location.assign('/auth/signin');
      return ok();
    },

    async getAccount() {
      const res = await authorized('/api/account', { method: 'GET' });
      if (!res.ok) return res;
      const body = (await res.value.json().catch(() => null)) as Partial<AccountInfo> | null;
      if (body?.provider !== 'google' || !Array.isArray(body.devices)) return serverError();
      return { ok: true, value: body as AccountInfo };
    },

    removeDevice: (id) =>
      send(`/api/account/devices/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    async signOut() {
      // Local sign-out must always work; the server call is best effort.
      await send('/api/auth/signout', { method: 'POST' });
      return ok();
    },

    signOutEverywhere: () => send('/api/account/signout-all', { method: 'POST' }),
    deleteAccount: () => send('/api/account', { method: 'DELETE' }),
  };
}
