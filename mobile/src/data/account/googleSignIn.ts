import Constants from 'expo-constants';
import { GoogleOneTapSignIn } from 'react-native-nitro-google-signin';

import { accountError } from '@/core/account/apiClient';
import type { Result } from '@/types/result.types';

function clientIds(): { webClientId: string; iosClientId: string } | null {
  const google = Constants.expoConfig?.extra?.google as
    | { webClientId?: unknown; iosClientId?: unknown }
    | undefined;
  const { webClientId, iosClientId } = google ?? {};
  if (typeof webClientId !== 'string' || webClientId === '') return null;
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
      GoogleOneTapSignIn.configure({ ...ids, nonce });
      return GoogleOneTapSignIn.createAccount();
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
    .then(() => GoogleOneTapSignIn.signOut())
    .catch(() => undefined);

  return { ok: true, value: { idToken } };
}
