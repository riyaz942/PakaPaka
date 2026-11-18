import { useEffect, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { isOnboardingCompleted } from '@/data/user/preferencesRepository';
import { useAccount } from '@/providers/AccountProvider';
import { useSync } from '@/providers/SyncProvider';

export type SignInSyncWaitState = 'none' | 'loading' | 'syncing' | 'failed';

/**
 * After a sign-in on a device whose onboarding is not finished, the app waits for the first sync
 * before it decides between the dashboard and onboarding: the account may already hold progress.
 * The learner ends the wait only by pressing "Start without sync".
 */
export function useSignInSyncWait(): {
  wait: SignInSyncWaitState;
  startWithoutSync(): void;
} {
  const { userDb } = useDatabase();
  const { status } = useAccount();
  const { firstRun } = useSync();
  const [skipped, setSkipped] = useState(false);

  // One row read on every render: a pull, a local finish of onboarding and an erase all change
  // the flag without a change of `userDb`, so a cached value goes stale.
  const completed = isOnboardingCompleted(userDb);

  // A later sign-in waits again.
  useEffect(() => {
    if (status === 'signed_out') setSkipped(false);
  }, [status]);

  let wait: SignInSyncWaitState;
  if (completed || skipped || status === 'signed_out') {
    wait = 'none';
  } else if (status === 'loading') {
    wait = 'loading';
  } else if (firstRun === 'failed') {
    wait = 'failed';
  } else if (firstRun === 'ok') {
    wait = 'none';
  } else {
    wait = 'syncing';
  }

  return { wait, startWithoutSync: () => setSkipped(true) };
}
