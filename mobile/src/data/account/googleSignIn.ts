import Constants from 'expo-constants';

import { accountError } from '@/core/account/apiClient';
import { needsIosGoogleClientId } from '@/platform/capabilities';
import type { Result } from '@/types/result.types';

// Loaded on use, not at import: the module creates its native object on load, so an older dev-client
// build without the native code would crash the app at launch instead of failing the sign-in.
function googleOneTap() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load, see above
  return (require('react-native-nitro-google-signin') as typeof import('react-native-nitro-google-signin')).GoogleOneTapSignIn;
}

function clientIds(): { webClientId: string; iosClientId?: string } | null {
  const google = Constants.expoConfig?.extra?.google as
    | { webClientId?: unknown; iosClientId?: unknown }
    | undefined;
  const { webClientId, iosClientId } = google ?? {};
  if (typeof webClientId !== 'string' || webClientId === '') return null;
  if (!needsIosGoogleClientId()) return { webClientId };
  if (typeof iosClientId !== 'string' || iosClientId === '') return null;
  return { webClientId, iosClientId };
}

export async function signInWithGoogleNative(
  nonce: string,
): Promise<Result<{ idToken: string }>> {
  const ids = clientIds();
  if (ids === null) return { ok: false, error: accountError('server') };

  // Library boundary: native calls reject (or throw synchronously) on misconfiguration.
  const response = await Promise.resolve()
    .then(() => {
      const googleSignIn = googleOneTap();
      googleSignIn.configure({ ...ids, nonce });
      return googleSignIn.createAccount();
    })
    .then(
      (value) => ({ ok: true as const, value }),
      (cause: unknown) => ({ ok: false as const, cause }),
    );
  if (!response.ok) return { ok: false, error: accountError('server', response.cause) };

  const { type, data } = response.value;
  if (type === 'cancelled') return { ok: false, error: accountError('cancelled') };
  const idToken = data?.idToken;
  if (type !== 'success' || !idToken) return { ok: false, error: accountError('server') };

  // Clear the library's cached ID token. A failure is ignored only because the token is
  // already in hand and the server verifies it once.
  await Promise.resolve()
    .then(() => googleOneTap().signOut())
    .catch(() => undefined);

  return { ok: true, value: { idToken } };
}
