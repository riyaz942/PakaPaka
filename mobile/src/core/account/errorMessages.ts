import type { AccountErrorCode } from '@/core/account/account.types';

const MESSAGES: Record<AccountErrorCode, string | null> = {
  paused: 'Sync is paused until tomorrow — your progress is safe on this device.',
  rate_limited: 'Too many attempts. Try again in a minute.',
  network: "Can't reach the server. Check your connection and try again.",
  session_ended: 'You were signed out. Sign in again to sync.',
  cancelled: null,
  not_found: 'Something went wrong. Try again.',
  server: 'Something went wrong. Try again.',
};

/** Shown instead of the generic signed-out copy when Delete account finds the session already ended. */
export const DELETE_SESSION_ENDED_MESSAGE =
  'You were signed out. Your account was not deleted. Sign in again to delete it.';

export function accountErrorMessage(code: AccountErrorCode): string | null {
  return MESSAGES[code];
}
