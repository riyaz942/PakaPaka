import { router } from 'expo-router';

import { isWeb } from '@/platform/capabilities';

/**
 * Where the learner lands after "Sign out and erase my data". On web the landing
 * page owns "/" and is a separate static page, so it needs a full page load; the
 * apps have no landing page and start onboarding again.
 */
export function leaveAfterErase(): void {
  if (isWeb()) {
    window.location.assign('/');
    return;
  }
  router.replace('/onboarding/welcome');
}
