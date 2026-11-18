import { useEffect, useMemo, useState } from 'react';

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
  const { firstRun, appliedVersion } = useSync();
  const [skipped, setSkipped] = useState(false);

  // A pull can write the onboarding flag, so the read repeats when `appliedVersion` changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const completed = useMemo(() => isOnboardingCompleted(userDb), [userDb, appliedVersion]);

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
