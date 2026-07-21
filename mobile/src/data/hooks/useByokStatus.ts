import { useCallback, useEffect, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { resolveActiveProvider } from '@/data/ai/aiConfig';
import type { ByokProvider } from '@/data/ai/byokCredential.types';
import { listConfiguredByokProviders } from '@/data/ai/byokCredentialStore';

type ByokStatus = {
  /** Null while the secure-store read is still in flight. */
  configured: ByokProvider[] | null;
  activeProvider: ByokProvider | null;
  isReady: boolean;
  refresh: () => void;
};

/**
 * Which BYOK providers hold a key, for the Conversation tab's
 * unconfigured/configured gate (FR87). Secure storage is async, so this settles
 * after mount — callers render nothing rather than flashing `KeySetup` at a
 * learner who has already configured a key.
 */
export function useByokStatus(): ByokStatus {
  const { userDb } = useDatabase();
  const [configured, setConfigured] = useState<ByokProvider[] | null>(null);

  const refresh = useCallback(() => {
    let cancelled = false;

    void listConfiguredByokProviders().then((result) => {
      if (cancelled) {
        return;
      }
      setConfigured(result.ok ? result.value : []);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = refresh();
    return cancel;
  }, [refresh]);

  return {
    configured,
    activeProvider: configured ? resolveActiveProvider(userDb, configured) : null,
    isReady: configured !== null,
    refresh: () => {
      refresh();
    },
  };
}
