/**
 * Stands in for the executorch Expo resource fetcher under Jest.
 *
 * The real fetcher downloads into `RNEDirectory` via a cache-then-move, so a
 * half-written file never appears in the directory `listDownloadedFiles` reads.
 * This mock keeps that property: `fetch` only records a file as present once it
 * resolves, so an interrupted download leaves nothing behind.
 */

const RNE_DIRECTORY = 'file:///mock-documents/react-native-executorch/';

function filenameFromUri(uri: string): string {
  let cleanUri = uri.replace(/^https?:\/\//, '');
  cleanUri = cleanUri.split('#')?.[0] ?? cleanUri;
  return cleanUri.replace(/[^a-zA-Z0-9._-]/g, '_');
}

const state = {
  downloaded: new Set<string>(),
  sizeByUri: new Map<string, number>(),
  fetchError: null as Error | null,
  sizeError: null as Error | null,
  progressSteps: [0.5, 1] as number[],
  fetchCallCount: 0,
};

export function __mockResetResourceFetcher(): void {
  state.downloaded.clear();
  state.sizeByUri.clear();
  state.fetchError = null;
  state.sizeError = null;
  state.progressSteps = [0.5, 1];
  state.fetchCallCount = 0;
}

/** Marks these source URLs as already present on disk. */
export function __mockMarkDownloaded(...uris: string[]): void {
  for (const uri of uris) {
    state.downloaded.add(filenameFromUri(uri));
  }
}

export function __mockSetRemoteSize(uri: string, bytes: number): void {
  state.sizeByUri.set(uri, bytes);
}

export function __mockFailFetch(error: Error): void {
  state.fetchError = error;
}

export function __mockFailSizeProbe(error: Error): void {
  state.sizeError = error;
}

export function __mockFetchCallCount(): number {
  return state.fetchCallCount;
}

export const ExpoResourceFetcher = {
  async listDownloadedFiles(): Promise<string[]> {
    return [...state.downloaded].map((filename) => `${RNE_DIRECTORY}${filename}`);
  },

  async getFilesTotalSize(...sources: unknown[]): Promise<number> {
    if (state.sizeError) {
      throw state.sizeError;
    }
    return sources.reduce<number>(
      (total, source) =>
        total + (typeof source === 'string' ? (state.sizeByUri.get(source) ?? 0) : 0),
      0,
    );
  },

  async fetch(
    callback?: (progress: number) => void,
    ...sources: unknown[]
  ): Promise<string[]> {
    state.fetchCallCount += 1;
    for (const step of state.progressSteps) {
      callback?.(step);
    }
    if (state.fetchError) {
      // Interrupted: nothing lands in the directory, mirroring the real
      // cache-then-move behaviour.
      throw state.fetchError;
    }
    const paths: string[] = [];
    for (const source of sources) {
      if (typeof source !== 'string') {
        continue;
      }
      const filename = filenameFromUri(source);
      state.downloaded.add(filename);
      paths.push(`${RNE_DIRECTORY}${filename}`);
    }
    return paths;
  },

  async deleteResources(...sources: unknown[]): Promise<void> {
    for (const source of sources) {
      if (typeof source === 'string') {
        state.downloaded.delete(filenameFromUri(source));
      }
    }
  },

  async cancelFetching(..._sources: unknown[]): Promise<void> {},
};
