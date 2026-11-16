import * as Device from 'expo-device';
import { Platform } from 'react-native';

import type { AccountInfo, AccountSession } from '@/core/account/account.types';
import { accountError, createApiClient, type ApiRequestInit } from '@/core/account/apiClient';
import {
  ACCESS_TTL_MS,
  createSessionManager,
  type SessionManager,
} from '@/core/account/sessionManager';
import { API_BASE_URL } from '@/config/api';
import { signInWithGoogleNative } from '@/data/account/googleSignIn';
import { secureTokenStore } from '@/data/account/tokenStore';
import type { Result } from '@/types/result.types';

const store = secureTokenStore;
const ok = (): Result<void> => ({ ok: true, value: undefined });
const serverError = (cause?: unknown): Result<never> => ({
  ok: false,
  error: accountError('server', cause),
});

// One manager for every caller: refresh rotation needs a single in-flight refresh.
const api = createApiClient({
  baseUrl: API_BASE_URL,
  fetch: (input, init) => globalThis.fetch(input, init),
});
let sharedManager: SessionManager | null = null;
function manager(): SessionManager {
  sharedManager ??= createSessionManager({ api, store, nowMs: Date.now });
  return sharedManager;
}

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

async function authorized(path: string, init: ApiRequestInit): Promise<Result<void>> {
  const res = await manager().authorizedRequest(path, init);
  return res.ok ? ok() : res;
}

async function signIn(): Promise<Result<void>> {
  const nonceRes = await api.request('/api/auth/nonce', { method: 'POST' });
  if (!nonceRes.ok) return nonceRes;
  const nonceBody = (await readJson(nonceRes.value)) as { nonce?: unknown } | null;
  if (typeof nonceBody?.nonce !== 'string') return serverError();
  const nonce = nonceBody.nonce;

  const google = await signInWithGoogleNative(nonce);
  if (!google.ok) return google;

  const exchange = await api.request('/api/auth/exchange', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: 'google',
      idToken: google.value.idToken,
      nonce,
      deviceLabel: Device.modelName ?? Platform.OS,
    }),
  });
  if (!exchange.ok) {
    // A 401 here is a rejected ID token, not an ended session.
    return exchange.error.code === 'session_ended' ? serverError(exchange.error) : exchange;
  }
  const tokens = (await readJson(exchange.value)) as {
    accessToken?: unknown;
    refreshToken?: unknown;
    deviceId?: unknown;
  } | null;
  if (
    typeof tokens?.accessToken !== 'string' ||
    typeof tokens.refreshToken !== 'string' ||
    typeof tokens.deviceId !== 'string'
  ) {
    return serverError();
  }

  return store.save({
    accessToken: tokens.accessToken,
    accessExpiresAtMs: Date.now() + ACCESS_TTL_MS,
    refreshToken: tokens.refreshToken,
    deviceId: tokens.deviceId,
  });
}

async function signOut(): Promise<Result<void>> {
  // Local sign-out must always work; the server row expires or shows in the device list.
  await authorized('/api/auth/signout', { method: 'POST' });
  return store.clear();
}

async function clearAfter(path: string, init: ApiRequestInit): Promise<Result<void>> {
  const done = await authorized(path, init);
  return done.ok ? store.clear() : done;
}

export function createAccountSession(): AccountSession {
  return {
    async isSignedIn() {
      const loaded = await store.load();
      return loaded.ok && loaded.value !== null;
    },

    signIn,

    async getAccount() {
      const res = await manager().authorizedRequest('/api/account', { method: 'GET' });
      if (!res.ok) return res;
      const body = (await readJson(res.value)) as Partial<AccountInfo> | null;
      if (body?.provider !== 'google' || !Array.isArray(body.devices)) return serverError();
      return { ok: true, value: body as AccountInfo };
    },

    async removeDevice(id) {
      const loaded = await store.load();
      if (loaded.ok && loaded.value?.deviceId === id) return signOut();
      return authorized(`/api/account/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    signOut,
    signOutEverywhere: () => clearAfter('/api/account/signout-all', { method: 'POST' }),
    deleteAccount: () => clearAfter('/api/account', { method: 'DELETE' }),
    request: (path, init) => manager().authorizedRequest(path, init),
  };
}
