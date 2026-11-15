import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { GoogleOneTapSignIn } from 'react-native-nitro-google-signin';

import { signInWithGoogleNative } from '@/data/account/googleSignIn';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

const configure = GoogleOneTapSignIn.configure as jest.Mock;
const createAccount = GoogleOneTapSignIn.createAccount as jest.Mock;
const libSignOut = GoogleOneTapSignIn.signOut as jest.Mock;

const setGoogleExtra = (google: unknown) => {
  (Constants.expoConfig as { extra: unknown }).extra = { google };
};

describe('signInWithGoogleNative', () => {
  beforeEach(() => {
    configure.mockReset();
    createAccount.mockReset();
    libSignOut.mockReset().mockResolvedValue(undefined);
    setGoogleExtra({ webClientId: 'web-id', iosClientId: 'ios-id' });
    Platform.OS = 'ios';
  });

  it('configures with the configured client IDs and the nonce, then returns the ID token', async () => {
    createAccount.mockResolvedValue({
      type: 'success',
      data: { idToken: 'id-token', user: {}, scopes: [] },
    });

    const result = await signInWithGoogleNative('nonce-1');

    expect(configure).toHaveBeenCalledWith({
      webClientId: 'web-id',
      iosClientId: 'ios-id',
      nonce: 'nonce-1',
    });
    expect(result).toEqual({ ok: true, value: { idToken: 'id-token' } });
  });

  it('clears the library cache after success, even when that fails', async () => {
    createAccount.mockResolvedValue({ type: 'success', data: { idToken: 't' } });
    libSignOut.mockRejectedValue(new Error('boom'));

    const result = await signInWithGoogleNative('n');

    expect(libSignOut).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });

  it('maps a cancelled response to the cancelled code', async () => {
    createAccount.mockResolvedValue({ type: 'cancelled', data: null });

    const result = await signInWithGoogleNative('n');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cancelled');
  });

  it('maps a response without an ID token to the server code', async () => {
    createAccount.mockResolvedValue({ type: 'noSavedCredentialFound', data: null });

    const result = await signInWithGoogleNative('n');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('server');
    expect(libSignOut).not.toHaveBeenCalled();
  });

  it('maps a rejected library call to the server code', async () => {
    createAccount.mockRejectedValue(new Error('DEVELOPER_ERROR'));

    const result = await signInWithGoogleNative('n');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('server');
  });

  it('maps a configure that throws to the server code', async () => {
    configure.mockImplementation(() => {
      throw new Error('bad config');
    });

    const result = await signInWithGoogleNative('n');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('server');
    expect(createAccount).not.toHaveBeenCalled();
  });

  it('maps a missing native module to the server code instead of crashing', async () => {
    jest.doMock('react-native-nitro-google-signin', () => {
      throw new Error('Cannot find native module NitroGoogleSignin');
    });
    try {
      // The isolated registry gives a fresh module graph, so the throwing mock applies only here.
      let fresh!: typeof import('@/data/account/googleSignIn');
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolated module load
        fresh = require('@/data/account/googleSignIn');
      });

      const result = await fresh.signInWithGoogleNative('n');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('server');
    } finally {
      jest.dontMock('react-native-nitro-google-signin');
    }
  });

  it('on Android needs only the web client ID and does not pass the iOS one', async () => {
    Platform.OS = 'android';
    setGoogleExtra({ webClientId: 'web-id', iosClientId: '' });
    createAccount.mockResolvedValue({ type: 'success', data: { idToken: 't' } });

    const result = await signInWithGoogleNative('n');

    expect(result.ok).toBe(true);
    expect(configure).toHaveBeenCalledWith({ webClientId: 'web-id', nonce: 'n' });
  });

  it('on iOS an empty iOS client ID fails with the server code', async () => {
    setGoogleExtra({ webClientId: 'web-id', iosClientId: '' });

    const result = await signInWithGoogleNative('n');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('server');
    expect(configure).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['empty', { webClientId: '', iosClientId: '' }],
    ['without a web client ID', { iosClientId: 'ios-id' }],
  ])('fails with the server code when the client IDs are %s', async (_name, google) => {
    setGoogleExtra(google);

    const result = await signInWithGoogleNative('n');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('server');
    expect(configure).not.toHaveBeenCalled();
  });
});
