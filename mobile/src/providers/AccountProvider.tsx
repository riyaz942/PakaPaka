import React, { createContext, useContext, useEffect, useState } from 'react';

import type { AccountInfo, AccountSession } from '@/core/account/account.types';
import { DELETE_SESSION_ENDED_MESSAGE } from '@/core/account/errorMessages';
import { createAccountSession } from '@/data/account/session';
import { supportsNativeGoogleSignIn, usesCookieSession } from '@/platform/capabilities';
import type { AppError, Result } from '@/types/result.types';

export type AccountStatus = 'signed_out' | 'loading' | 'signed_in';
export type SignInResult = 'ok' | 'failed' | 'cancelled';

export type AccountContextValue = {
  status: AccountStatus;
  account: AccountInfo | null;
  error: string | null;
  signInResult: SignInResult | null;
  /** True when the last sign-out came from a session that ended without the user. */
  sessionEnded: boolean;
  signIn(): Promise<void>;
  refresh(): Promise<void>;
  removeDevice(id: string): Promise<void>;
  /** Resolves true when this device ended up signed out. */
  signOut(): Promise<boolean>;
  signOutEverywhere(): Promise<boolean>;
  /** Resolves true only when the server delete worked. */
  deleteAccount(): Promise<boolean>;
};

type State = Pick<
  AccountContextValue,
  'status' | 'account' | 'error' | 'signInResult' | 'sessionEnded'
>;

const SIGN_IN_FAILED_MESSAGE = 'Sign-in did not finish. Try again.';

const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) {
    throw new Error('useAccount must be used within AccountProvider');
  }
  return value;
}

function isSignInResult(value: string | null): value is SignInResult {
  return value === 'ok' || value === 'failed' || value === 'cancelled';
}

/** Reads `?signin=` once from the web callback redirect, then removes it from the URL. */
function takeSignInResult(): SignInResult | null {
  const url = new URL(window.location.href);
  const value = url.searchParams.get('signin');
  if (value === null) return null;
  url.searchParams.delete('signin');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  return isSignInResult(value) ? value : null;
}

export function AccountProvider({
  children,
  session: injected,
}: {
  children: React.ReactNode;
  /** Tests pass a session; the app uses the platform default. */
  session?: AccountSession;
}) {
  const [session] = useState(() => injected ?? createAccountSession());
  const [state, setState] = useState<State>({
    status: 'loading',
    account: null,
    error: null,
    signInResult: null,
    sessionEnded: false,
  });

  const merge = (patch: Partial<State>) => setState((prev) => ({ ...prev, ...patch }));
  const signedOut = (error: string | null = null, sessionEnded = false) =>
    merge({ status: 'signed_out', account: null, error, sessionEnded });

  /**
   * A session that ended is final; any other failure leaves the user where they are.
   * Returns true when the user ended up signed out.
   */
  function fail(error: AppError): boolean {
    if (error.code === 'session_ended') {
      signedOut(error.userMessage ?? null, true);
      return true;
    }
    merge({ error: error.userMessage ?? null });
    return false;
  }

  async function loadAccount() {
    const result = await session.getAccount();
    if (result.ok) {
      merge({ status: 'signed_in', account: result.value, error: null, sessionEnded: false });
    } else {
      // A cookie or token exists, so the user is signed in even if the details failed to load.
      merge({ status: 'signed_in', sessionEnded: false });
      fail(result.error);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (usesCookieSession()) {
        const result = takeSignInResult();
        if (result !== null) {
          merge({
            signInResult: result,
            error: result === 'failed' ? SIGN_IN_FAILED_MESSAGE : null,
          });
        }
      }
      const signedIn = await session.isSignedIn();
      if (cancelled) return;
      if (!signedIn) {
        merge({ status: 'signed_out' });
        return;
      }
      await loadAccount();
    }
    void start();
    return () => {
      cancelled = true;
    };
    // loadAccount and merge are recreated each render; the mount check runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  /** Runs a server call that ends the session on success. */
  async function endSession(call: () => Promise<Result<void>>): Promise<boolean> {
    const result = await call();
    if (result.ok) {
      signedOut();
      return true;
    }
    return fail(result.error);
  }

  const value: AccountContextValue = {
    ...state,

    async signIn() {
      merge({ error: null });
      const result = await session.signIn();
      if (!result.ok) {
        fail(result.error);
        return;
      }
      // The web flow leaves the page; the new session is read when it returns.
      if (supportsNativeGoogleSignIn()) {
        merge({ status: 'loading' });
        await loadAccount();
      }
    },

    async refresh() {
      merge({ error: null });
      await loadAccount();
    },

    async removeDevice(id) {
      const removedCurrent = state.account?.devices.some((d) => d.deviceId === id && d.current);
      const result = await session.removeDevice(id);
      if (!result.ok) {
        fail(result.error);
      } else if (removedCurrent) {
        signedOut();
      } else {
        await value.refresh();
      }
    },

    async signOut() {
      const result = await session.signOut();
      if (result.ok) {
        signedOut();
        return true;
      }
      // Web cookies only clear on the server, so the user is still signed in.
      if (usesCookieSession()) return fail(result.error);
      // Native sign-out always ends signed out; the device tokens are gone.
      signedOut(result.error.userMessage ?? null);
      return true;
    },

    signOutEverywhere: () => endSession(() => session.signOutEverywhere()),
    async deleteAccount() {
      const result = await session.deleteAccount();
      if (result.ok) {
        signedOut();
        return true;
      }
      if (result.error.code === 'session_ended') signedOut(DELETE_SESSION_ENDED_MESSAGE, true);
      else fail(result.error);
      return false;
    },
  };

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
