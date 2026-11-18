import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import type { SignInSyncWaitState } from '@/hooks/useSignInSyncWait';
import { useSync } from '@/providers/SyncProvider';

/** After this long the learner may start without waiting for the first sync. */
const START_WITHOUT_SYNC_AFTER_MS = 10_000;

/**
 * Full-screen cover while the app waits for the first sync after a sign-in. The loading state
 * shows a spinner only: a signed-out learner never sees sync text.
 */
export function SignInSyncWait({
  wait,
  onRetry,
  onStartWithoutSync,
}: {
  wait: SignInSyncWaitState;
  onRetry(): void;
  onStartWithoutSync(): void;
}) {
  const { error } = useSync();
  const [late, setLate] = useState(false);
  const waiting = wait === 'loading' || wait === 'syncing';

  useEffect(() => {
    if (!waiting) {
      setLate(false);
      return;
    }
    const timer = setTimeout(() => setLate(true), START_WITHOUT_SYNC_AFTER_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  if (wait === 'none') return null;

  return (
    <View
      testID="signin-sync-wait"
      className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center gap-space-md bg-background px-space-lg">
      {wait === 'failed' ? (
        <>
          <Text className="text-center text-body text-secondary">
            {error ?? 'Sync did not finish.'}
          </Text>
          <Button label="Try again" onPress={onRetry} />
          <Button label="Start without sync" variant="secondary" onPress={onStartWithoutSync} />
        </>
      ) : (
        <>
          <ActivityIndicator accessibilityLabel="Loading" />
          {wait === 'syncing' ? (
            <Text className="text-body text-secondary">Getting your progress…</Text>
          ) : null}
          {late ? (
            <Button label="Start without sync" variant="secondary" onPress={onStartWithoutSync} />
          ) : null}
        </>
      )}
    </View>
  );
}
