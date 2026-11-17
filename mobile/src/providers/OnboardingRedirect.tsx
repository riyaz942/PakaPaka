import { useOnboardingRedirect } from '@/hooks/useOnboardingRedirect';
import { useSync } from '@/providers/SyncProvider';

export function OnboardingRedirect() {
  useOnboardingRedirect(useSync().appliedVersion);
  return null;
}
