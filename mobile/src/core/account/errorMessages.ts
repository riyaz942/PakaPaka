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

export function accountErrorMessage(code: AccountErrorCode): string | null {
  return MESSAGES[code];
}
