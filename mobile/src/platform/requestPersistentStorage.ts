export type PersistentStorageResult = 'granted' | 'denied' | 'unsupported';

/** Native storage is not evicted by the OS the way browser storage is: nothing to request. */
export async function requestPersistentStorage(): Promise<PersistentStorageResult> {
  return 'granted';
}
