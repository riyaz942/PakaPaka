import * as SecureStore from 'expo-secure-store';

import { secureTokenStore } from '@/data/account/tokenStore';

const stored = {
  accessToken: 'at',
  accessExpiresAtMs: 123,
  refreshToken: 'rt',
  deviceId: 'dev-1',
};

describe('secureTokenStore', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('account_session_v1');
  });

  it('loads null when nothing is stored', async () => {
    expect(await secureTokenStore.load()).toEqual({ ok: true, value: null });
  });

  it('round-trips a session through secure storage', async () => {
    expect((await secureTokenStore.save(stored)).ok).toBe(true);

    expect(JSON.parse((await SecureStore.getItemAsync('account_session_v1')) as string)).toEqual(
      stored,
    );
    expect(await secureTokenStore.load()).toEqual({ ok: true, value: stored });
  });

  it('saves with the this-device-only keychain option', async () => {
    const setItem = jest.spyOn(SecureStore, 'setItemAsync');

    await secureTokenStore.save(stored);

    expect(setItem).toHaveBeenCalledWith('account_session_v1', JSON.stringify(stored), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    setItem.mockRestore();
  });

  it('clear removes the session', async () => {
    await secureTokenStore.save(stored);

    expect((await secureTokenStore.clear()).ok).toBe(true);

    expect(await secureTokenStore.load()).toEqual({ ok: true, value: null });
  });

  it('reports an unreadable stored value as a secure store error', async () => {
    await SecureStore.setItemAsync('account_session_v1', 'not json');

    const result = await secureTokenStore.load();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('secure_store_error');
  });

  it('reports a stored value with the wrong shape as a secure store error', async () => {
    await SecureStore.setItemAsync('account_session_v1', JSON.stringify({ accessToken: 1 }));

    const result = await secureTokenStore.load();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('secure_store_error');
  });
});
