import * as SecureStore from 'expo-secure-store';

import { __mockResetSecureStore } from '../../../__mocks__/expo-secure-store';

import {
  discardAllImportCredentials,
  discardImportCredential,
  getImportCredential,
  hasImportCredential,
  saveImportCredential,
} from '@/data/user/credentialStore';
import { IMPORT_CREDENTIAL_KEYS } from '@/data/user/importCredential.types';

describe('credentialStore', () => {
  const SAMPLE_WANIKANI_KEY = 'wk-test-api-key-12345';
  const SAMPLE_BUNPRO_KEY = 'bp-test-api-key-67890';

  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    __mockResetSecureStore();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  function assertCredentialNeverLogged(credential: string): void {
    const allCalls = [
      ...consoleLogSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
      ...consoleErrorSpy.mock.calls,
    ];

    for (const call of allCalls) {
      for (const arg of call) {
        if (typeof arg === 'string') {
          expect(arg).not.toContain(credential);
        }
      }
    }
  }

  it('returns null when credential is unset', async () => {
    const result = await getImportCredential('wanikani');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  it('round-trips save and get for wanikani', async () => {
    const saveResult = await saveImportCredential('wanikani', SAMPLE_WANIKANI_KEY);
    expect(saveResult.ok).toBe(true);

    const getResult = await getImportCredential('wanikani');
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.value).toBe(SAMPLE_WANIKANI_KEY);
    }

    assertCredentialNeverLogged(SAMPLE_WANIKANI_KEY);
  });

  it('round-trips save and get for bunpro', async () => {
    const saveResult = await saveImportCredential('bunpro', SAMPLE_BUNPRO_KEY);
    expect(saveResult.ok).toBe(true);

    const getResult = await getImportCredential('bunpro');
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.value).toBe(SAMPLE_BUNPRO_KEY);
    }

    assertCredentialNeverLogged(SAMPLE_BUNPRO_KEY);
  });

  it('trims whitespace from keys before storage', async () => {
    const paddedKey = `  ${SAMPLE_WANIKANI_KEY}  `;
    const saveResult = await saveImportCredential('wanikani', paddedKey);
    expect(saveResult.ok).toBe(true);

    const getResult = await getImportCredential('wanikani');
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.value).toBe(SAMPLE_WANIKANI_KEY);
    }
  });

  it('rejects empty and whitespace-only keys with invalid_credential', async () => {
    for (const invalidKey of ['', '   ', '\t\n']) {
      const result = await saveImportCredential('wanikani', invalidKey);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('invalid_credential');
      }
    }

    const getResult = await getImportCredential('wanikani');
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.value).toBeNull();
    }
  });

  it('reports hasImportCredential true when set and false when unset', async () => {
    const unsetResult = await hasImportCredential('wanikani');
    expect(unsetResult.ok).toBe(true);
    if (unsetResult.ok) {
      expect(unsetResult.value).toBe(false);
    }

    await saveImportCredential('wanikani', SAMPLE_WANIKANI_KEY);

    const setResult = await hasImportCredential('wanikani');
    expect(setResult.ok).toBe(true);
    if (setResult.ok) {
      expect(setResult.value).toBe(true);
    }
  });

  it('isolates credentials per source', async () => {
    await saveImportCredential('wanikani', SAMPLE_WANIKANI_KEY);
    await saveImportCredential('bunpro', SAMPLE_BUNPRO_KEY);

    const wanikaniResult = await getImportCredential('wanikani');
    const bunproResult = await getImportCredential('bunpro');

    expect(wanikaniResult.ok).toBe(true);
    expect(bunproResult.ok).toBe(true);
    if (wanikaniResult.ok && bunproResult.ok) {
      expect(wanikaniResult.value).toBe(SAMPLE_WANIKANI_KEY);
      expect(bunproResult.value).toBe(SAMPLE_BUNPRO_KEY);
    }
  });

  it('discardImportCredential removes the stored value', async () => {
    await saveImportCredential('wanikani', SAMPLE_WANIKANI_KEY);

    const discardResult = await discardImportCredential('wanikani');
    expect(discardResult.ok).toBe(true);

    const getResult = await getImportCredential('wanikani');
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.value).toBeNull();
    }

    assertCredentialNeverLogged(SAMPLE_WANIKANI_KEY);
  });

  it('discardImportCredential is idempotent when credential is missing', async () => {
    const discardResult = await discardImportCredential('bunpro');
    expect(discardResult.ok).toBe(true);
  });

  it('discardAllImportCredentials clears both sources', async () => {
    await saveImportCredential('wanikani', SAMPLE_WANIKANI_KEY);
    await saveImportCredential('bunpro', SAMPLE_BUNPRO_KEY);

    const discardResult = await discardAllImportCredentials();
    expect(discardResult.ok).toBe(true);

    const wanikaniResult = await getImportCredential('wanikani');
    const bunproResult = await getImportCredential('bunpro');

    expect(wanikaniResult.ok).toBe(true);
    expect(bunproResult.ok).toBe(true);
    if (wanikaniResult.ok && bunproResult.ok) {
      expect(wanikaniResult.value).toBeNull();
      expect(bunproResult.value).toBeNull();
    }
  });

  it('discardAllImportCredentials is safe when no credentials exist', async () => {
    const discardResult = await discardAllImportCredentials();
    expect(discardResult.ok).toBe(true);
  });

  it('maps SecureStore failures to secure_store_error without embedding the credential', async () => {
    const underlyingError = new Error('Keychain access denied');
    jest.spyOn(SecureStore, 'setItemAsync').mockRejectedValueOnce(underlyingError);

    const result = await saveImportCredential('wanikani', SAMPLE_WANIKANI_KEY);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('secure_store_error');
      expect(result.error.message).toBe('Secure storage operation failed');
      expect(result.error.message).not.toContain(SAMPLE_WANIKANI_KEY);
      expect(JSON.stringify(result.error)).not.toContain(SAMPLE_WANIKANI_KEY);
      expect(result.error.cause).toBe(underlyingError);
    }

    assertCredentialNeverLogged(SAMPLE_WANIKANI_KEY);
  });

  it('uses WHEN_UNLOCKED_THIS_DEVICE_ONLY when saving credentials', async () => {
    const setItemSpy = jest.spyOn(SecureStore, 'setItemAsync');

    await saveImportCredential('wanikani', SAMPLE_WANIKANI_KEY);

    expect(setItemSpy).toHaveBeenCalledWith(
      IMPORT_CREDENTIAL_KEYS.wanikani,
      SAMPLE_WANIKANI_KEY,
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );

    setItemSpy.mockRestore();
  });
});
