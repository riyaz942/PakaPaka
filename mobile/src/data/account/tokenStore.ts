import * as SecureStore from 'expo-secure-store';

import type { StoredSession, TokenStore } from '@/core/account/sessionManager';
import type { Result } from '@/types/result.types';

const SESSION_KEY = 'account_session_v1';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function secureStoreError(cause: unknown): Result<never> {
  return {
    ok: false,
    error: {
      code: 'secure_store_error',
      message: 'Secure storage operation failed',
      userMessage: 'Could not access secure storage.',
      cause,
    },
  };
}

function isStoredSession(value: unknown): value is StoredSession {
  const s = value as Partial<StoredSession> | null;
  return (
    typeof s?.accessToken === 'string' &&
    typeof s.accessExpiresAtMs === 'number' &&
    typeof s.refreshToken === 'string' &&
    typeof s.deviceId === 'string'
  );
}

export const secureTokenStore: TokenStore = {
  async load() {
    try {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (raw === null) return { ok: true, value: null };
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredSession(parsed)) return secureStoreError(new Error('Unexpected session shape'));
      return { ok: true, value: parsed };
    } catch (cause) {
      return secureStoreError(cause);
    }
  },

  async save(session) {
    try {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), SECURE_OPTIONS);
      return { ok: true, value: undefined };
    } catch (cause) {
      return secureStoreError(cause);
    }
  },

  async clear() {
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return { ok: true, value: undefined };
    } catch (cause) {
      return secureStoreError(cause);
    }
  },
};
