import * as SecureStore from 'expo-secure-store';

import {
  BYOK_CREDENTIAL_KEYS,
  BYOK_PROVIDERS,
  type ByokProvider,
} from '@/data/ai/byokCredential.types';
import type { Result } from '@/types/result.types';

/**
 * BYOK key storage (FR88, NFR24). Same mechanism as the import credentials in
 * `data/user/credentialStore.ts` — platform secure storage, this-device-only,
 * `Result`-returning — under its own key namespace. Keys are only ever read to
 * build a request to the endpoint the user configured; nothing else reads them.
 */

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

export async function saveByokKey(
  provider: ByokProvider,
  apiKey: string,
): Promise<Result<void>> {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: { code: 'invalid_credential', message: 'API key is empty' } };
  }

  try {
    await SecureStore.setItemAsync(BYOK_CREDENTIAL_KEYS[provider], trimmed, SECURE_OPTIONS);
    return { ok: true, value: undefined };
  } catch (cause) {
    return secureStoreError(cause);
  }
}

export async function getByokKey(provider: ByokProvider): Promise<Result<string | null>> {
  try {
    const value = await SecureStore.getItemAsync(BYOK_CREDENTIAL_KEYS[provider]);
    return { ok: true, value };
  } catch (cause) {
    return secureStoreError(cause);
  }
}

export async function hasByokKey(provider: ByokProvider): Promise<Result<boolean>> {
  const result = await getByokKey(provider);
  if (!result.ok) {
    return result;
  }

  return { ok: true, value: Boolean(result.value && result.value.trim().length > 0) };
}

export async function discardByokKey(provider: ByokProvider): Promise<Result<void>> {
  try {
    await SecureStore.deleteItemAsync(BYOK_CREDENTIAL_KEYS[provider]);
    return { ok: true, value: undefined };
  } catch (cause) {
    return secureStoreError(cause);
  }
}

/** Which providers currently have a key, for the tab's configured/unconfigured gate. */
export async function listConfiguredByokProviders(): Promise<Result<ByokProvider[]>> {
  const configured: ByokProvider[] = [];

  for (const provider of BYOK_PROVIDERS) {
    const result = await hasByokKey(provider);
    if (!result.ok) {
      return result;
    }
    if (result.value) {
      configured.push(provider);
    }
  }

  return { ok: true, value: configured };
}
