import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

let initialised = false;

/**
 * Registers the Expo resource fetcher executorch downloads through.
 *
 * Deliberately lazy rather than called from app init: voice is opt-in and its
 * models are ~1 GB, so nothing about it may sit on the cold-start path (NFR3,
 * NFR25). Importing this module does nothing; the first explicit voice action
 * pays the cost.
 */
export function ensureExecutorchInitialised(): void {
  if (initialised) {
    return;
  }
  initExecutorch({ resourceFetcher: ExpoResourceFetcher });
  initialised = true;
}
