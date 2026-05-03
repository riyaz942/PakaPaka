import * as Updates from 'expo-updates';

/**
 * Reads Expo Updates runtime metadata without throwing when updates are disabled,
 * no OTA payload exists, or the native module is unavailable.
 */
export function readUpdatesRuntimeMetadata(): {
  runtimeVersion: string | null;
  isEmbeddedLaunch: boolean | undefined;
} {
  try {
    return {
      runtimeVersion: Updates.runtimeVersion ?? null,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    };
  } catch {
    return { runtimeVersion: null, isEmbeddedLaunch: undefined };
  }
}
