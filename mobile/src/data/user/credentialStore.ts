import * as SecureStore from 'expo-secure-store';

import {
  IMPORT_CREDENTIAL_KEYS,
  type ImportCredentialSource,
} from '@/data/user/importCredential.types';
import type { Result } from '@/types/result.types';

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

export async function saveImportCredential(
  source: ImportCredentialSource,
  apiKey: string,
): Promise<Result<void>> {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: { code: 'invalid_credential', message: 'API key is empty' } };
  }

  try {
    await SecureStore.setItemAsync(IMPORT_CREDENTIAL_KEYS[source], trimmed, SECURE_OPTIONS);
    return { ok: true, value: undefined };
  } catch (cause) {
    return secureStoreError(cause);
  }
}

export async function getImportCredential(
  source: ImportCredentialSource,
): Promise<Result<string | null>> {
  try {
    const value = await SecureStore.getItemAsync(IMPORT_CREDENTIAL_KEYS[source]);
    return { ok: true, value };
  } catch (cause) {
    return secureStoreError(cause);
  }
}

export async function hasImportCredential(
  source: ImportCredentialSource,
): Promise<Result<boolean>> {
  const result = await getImportCredential(source);
  if (!result.ok) {
    return result;
  }

  return { ok: true, value: result.value !== null };
}

export async function discardImportCredential(
  source: ImportCredentialSource,
): Promise<Result<void>> {
  try {
    await SecureStore.deleteItemAsync(IMPORT_CREDENTIAL_KEYS[source]);
    return { ok: true, value: undefined };
  } catch (cause) {
    return secureStoreError(cause);
  }
}

export async function discardAllImportCredentials(): Promise<Result<void>> {
  const sources: ImportCredentialSource[] = ['wanikani', 'bunpro'];

  for (const source of sources) {
    const result = await discardImportCredential(source);
    if (!result.ok) {
      return result;
    }
  }

  return { ok: true, value: undefined };
}
