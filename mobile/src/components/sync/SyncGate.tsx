import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { useAccount } from '@/providers/AccountProvider';
import { useSync } from '@/providers/SyncProvider';

/** After this long the learner may start without waiting for the sync. */
const START_NOW_AFTER_MS = 3000;

/**
 * Wraps a study stack. Signed in, a review first pulls the latest progress; while the study
 * stack is open, a sync does not change progress rows, and leaving it starts a sync.
 */
export function SyncGate({
  mode,
  children,
}: {
  mode: 'review' | 'lesson';
  children: React.ReactNode;
}) {
  const { status } = useAccount();
  const { runBeforeReview, beginStudy, endStudy } = useSync();
  // Decided once: a study stack does not change its gate while it is open.
  const [signedIn] = useState(status === 'signed_in');
  const [open, setOpen] = useState(!signedIn || mode === 'lesson');
  const [showStartNow, setShowStartNow] = useState(false);
  const started = useRef(false);

  function start() {
    if (started.current) return;
    started.current = true;
    beginStudy();
    setOpen(true);
  }

  useEffect(() => {
    if (!signedIn) return undefined;
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (mode === 'lesson') {
      start();
    } else {
      void runBeforeReview().then(() => {
        if (mounted) start();
      });
      timer = setTimeout(() => setShowStartNow(true), START_NOW_AFTER_MS);
    }
    return () => {
      mounted = false;
      if (timer !== null) clearTimeout(timer);
      if (started.current) {
        started.current = false;
        endStudy();
      }
    };
    // Runs once per mount: the gate starts one study and ends it on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (open) return <>{children}</>;

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-space-md bg-background px-space-lg">
      <ActivityIndicator />
      <Text className="text-body text-secondary">Syncing your progress…</Text>
      {showStartNow ? (
        <Button label="Start now" variant="secondary" onPress={start} />
      ) : null}
    </SafeAreaView>
  );
}
