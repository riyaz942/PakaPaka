import * as Network from 'expo-network';

/**
 * Connectivity gate for the Conversation tab (NFR24, UX-DR22).
 *
 * BYOK chat is the one surface that genuinely requires internet — every other
 * tab stays fully usable offline, so this check is scoped to Conversation and
 * must not be hoisted into a global gate.
 */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected) && state.isInternetReachable !== false;
  } catch {
    // A failed probe is not proof of being offline; let the request itself be
    // the source of truth rather than blocking the tab on a flaky check.
    return true;
  }
}
