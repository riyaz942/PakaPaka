import { useCallback, useEffect, useRef, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { resolveActiveProvider } from '@/data/ai/aiConfig';
import type { ByokProvider } from '@/data/ai/byokCredential.types';
import { listConfiguredByokProviders } from '@/data/ai/byokCredentialStore';
import type { AppError } from '@/types/result.types';

type ByokStatus = {
  /** Null while the secure-store read is still in flight. */
  configured: ByokProvider[] | null;
  activeProvider: ByokProvider | null;
  isReady: boolean;
  error: AppError | null;
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
  const [error, setError] = useState<AppError | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(() => {
    const requestId = ++requestIdRef.current;

    void listConfiguredByokProviders().then((result) => {
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (!result.ok) {
        setError(result.error);
        setConfigured([]);
        return;
      }
      setError(null);
      setConfigured(result.value);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    configured,
    activeProvider: configured ? resolveActiveProvider(userDb, configured) : null,
    isReady: configured !== null,
    error,
    refresh,
  };
}
