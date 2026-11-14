export type PersistentStorageResult = 'granted' | 'denied' | 'unsupported';

/**
 * Asks the browser not to evict this origin's storage (OPFS holds user.db).
 * Never throws: a browser that refuses or lacks the API reports it.
 */
export async function requestPersistentStorage(): Promise<PersistentStorageResult> {
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (!storage?.persist || !storage.persisted) {
      return 'unsupported';
    }
    if (await storage.persisted()) {
      return 'granted';
    }
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}
