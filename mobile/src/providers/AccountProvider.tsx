import React, { createContext, useContext, useEffect, useState } from 'react';

import type { AccountInfo, AccountSession } from '@/core/account/account.types';
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
  signIn(): Promise<void>;
  refresh(): Promise<void>;
  removeDevice(id: string): Promise<void>;
  signOut(): Promise<void>;
  signOutEverywhere(): Promise<void>;
  deleteAccount(): Promise<void>;
};

type State = Pick<AccountContextValue, 'status' | 'account' | 'error' | 'signInResult'>;

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
  });

  const merge = (patch: Partial<State>) => setState((prev) => ({ ...prev, ...patch }));
  const signedOut = (error: string | null = null) =>
    merge({ status: 'signed_out', account: null, error });

  /** A session that ended is final; any other failure leaves the user where they are. */
  function fail(error: AppError) {
    if (error.code === 'session_ended') {
      signedOut(error.userMessage ?? null);
    } else {
      merge({ error: error.userMessage ?? null });
    }
  }

  async function loadAccount() {
    const result = await session.getAccount();
    if (result.ok) {
      merge({ status: 'signed_in', account: result.value, error: null });
    } else {
      // A cookie or token exists, so the user is signed in even if the details failed to load.
      merge({ status: 'signed_in' });
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
  async function endSession(call: () => Promise<Result<void>>) {
    const result = await call();
    if (result.ok) signedOut();
    else fail(result.error);
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
      } else if (usesCookieSession()) {
        // Web cookies only clear on the server, so the user is still signed in.
        fail(result.error);
      } else {
        // Native sign-out always ends signed out; the device tokens are gone.
        signedOut(result.error.userMessage ?? null);
      }
    },

    signOutEverywhere: () => endSession(() => session.signOutEverywhere()),
    deleteAccount: () => endSession(() => session.deleteAccount()),
  };

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
