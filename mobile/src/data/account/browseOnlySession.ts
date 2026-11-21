import type { AccountSession } from '@/core/account/account.types';
import type { AppError, Result } from '@/types/result.types';

const BROWSE_ONLY_ERROR: AppError = {
  code: 'BROWSE_ONLY',
  message: 'This tab is browse-only; the account runs in the other tab.',
};

function refuse<T>(): Promise<Result<T>> {
  return Promise.resolve({ ok: false, error: BROWSE_ONLY_ERROR });
}

/**
 * Web browse-only tab: looks signed out and makes no network call, so sync
 * never runs and no sign-out or erase can happen in this tab.
 */
export const browseOnlySession: AccountSession = {
  isSignedIn: () => Promise.resolve(false),
  signIn: () => refuse(),
  getAccount: () => refuse(),
  removeDevice: () => refuse(),
  signOut: () => refuse(),
  signOutEverywhere: () => refuse(),
  deleteAccount: () => refuse(),
  request: () => refuse(),
};
