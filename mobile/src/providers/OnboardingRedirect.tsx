import { SignInSyncWait } from '@/components/sync/SignInSyncWait';
import { useOnboardingRedirect } from '@/hooks/useOnboardingRedirect';
import { useSignInSyncWait } from '@/hooks/useSignInSyncWait';
import { useSync } from '@/providers/SyncProvider';

export function OnboardingRedirect() {
  const { appliedVersion, retryFirstRun } = useSync();
  const { wait, startWithoutSync } = useSignInSyncWait();
  useOnboardingRedirect(appliedVersion, wait !== 'none');
  return (
    <SignInSyncWait
      wait={wait}
      onRetry={() => void retryFirstRun()}
      onStartWithoutSync={startWithoutSync}
    />
  );
}
