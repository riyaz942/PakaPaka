import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { leaveAfterErase } from '@/components/settings/leaveAfterErase';
import { useDatabase } from '@/data/hooks/useDatabase';
import { eraseLocalData } from '@/data/user/restoreBackup';
import { useAccount } from '@/providers/AccountProvider';
import { useSync } from '@/providers/SyncProvider';

/**
 * After a session that ended without the learner: erases this device and leaves when nothing is
 * unsynced; otherwise asks first and keeps the data until a button is pressed.
 */
export function SessionEndedHost() {
  const { sessionEnd } = useSync();
  const { signIn, error } = useAccount();
  const { userDb } = useDatabase();
  const [eraseError, setEraseError] = useState<string | null>(null);
  /** Set once this episode's automatic erase ran; reset when the episode ends. */
  const erased = useRef(false);

  function erase() {
    const result = eraseLocalData(userDb);
    if (!result.ok) {
      setEraseError(result.error.userMessage ?? result.error.message);
      return;
    }
    leaveAfterErase();
  }

  useEffect(() => {
    if (sessionEnd === 'none') {
      erased.current = false;
      setEraseError(null);
      return;
    }
    if (sessionEnd === 'erase' && !erased.current) {
      erased.current = true;
      erase();
    }
    // erase is recreated each render; the erase follows sessionEnd only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEnd]);

  if (sessionEnd === 'none' || (sessionEnd === 'erase' && eraseError === null)) return null;

  return (
    <View
      testID="session-ended"
      className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center gap-space-md bg-background px-space-lg">
      <Text
        accessibilityRole="header"
        className="text-center text-title-lg font-ui-extrabold text-primary">
        You were signed out
      </Text>
      <Text className="text-center text-body text-secondary">
        This device has progress that is not synced yet. Sign in again to sync it, or erase it from
        this device.
      </Text>
      <Button label="Sign in to sync it" onPress={() => void signIn()} />
      <Button label="Erase anyway" variant="destructive" onPress={erase} />
      {eraseError !== null || error !== null ? (
        <Text className="text-center text-body text-secondary">{eraseError ?? error}</Text>
      ) : null}
    </View>
  );
}
