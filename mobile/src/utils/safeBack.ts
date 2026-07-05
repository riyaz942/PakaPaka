import { router } from 'expo-router';

/**
 * Goes back when a previous screen exists; otherwise lands on the tab shell.
 * Prevents Android from closing the app when a screen was reached via
 * `router.replace` (empty stack).
 */
export function safeBack(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(tabs)');
  }
}
