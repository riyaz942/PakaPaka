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
 * Nothing is decided while the account status is still loading.
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
  const [open, setOpen] = useState(mode === 'lesson' || status === 'signed_out');
  const [pulling, setPulling] = useState(false);
  const [showStartNow, setShowStartNow] = useState(false);
  const decided = useRef(false);
  const started = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function start() {
    if (started.current) return;
    started.current = true;
    beginStudy();
    setOpen(true);
  }

  useEffect(() => {
    if (decided.current || status === 'loading') return;
    if (mode === 'lesson') {
      if (status === 'signed_in') {
        decided.current = true;
        start();
      }
      return;
    }
    decided.current = true;
    if (status === 'signed_out') {
      setOpen(true);
      return;
    }
    setPulling(true);
    void runBeforeReview().then(() => {
      if (mounted.current) start();
    });
    timer.current = setTimeout(() => setShowStartNow(true), START_NOW_AFTER_MS);
    // The gate decides once, on the first status that is not loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current !== null) clearTimeout(timer.current);
      if (started.current) {
        started.current = false;
        endStudy();
      }
    };
    // Unmount only: the gate ends the study it started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (open) return <>{children}</>;

  // While the account status loads, a spinner only: a signed-out learner sees no sync text.
  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-space-md bg-background px-space-lg">
      <ActivityIndicator accessibilityLabel={pulling ? 'Syncing your progress' : 'Loading'} />
      {pulling ? <Text className="text-body text-secondary">Syncing your progress…</Text> : null}
      {showStartNow ? (
        <Button label="Start now" variant="secondary" onPress={start} />
      ) : null}
    </SafeAreaView>
  );
}
