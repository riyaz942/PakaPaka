/**
 * Stands in for `react-native-blob-util` under Jest — the model files on disk
 * and the HEAD answers of the model host.
 *
 * The executorch `download` mock writes here (see `__mockRunDownload`), and it
 * only records a file once the whole download resolves, mirroring the real
 * fetcher's `.partial`-then-rename: an interrupted download leaves nothing that
 * a presence check would mistake for a model.
 *
 * `cachePathFor` mirrors the real fetcher exactly, because the download
 * manager's presence check depends on that derivation matching what the
 * fetcher wrote.
 */

import { Platform } from 'react-native';

const dirs = {
  DocumentDir: '/mock-documents',
  SDCardDir: '/mock-external',
};

const MODEL_DIRECTORY = `${
  Platform.OS === 'android' ? dirs.SDCardDir || dirs.DocumentDir : dirs.DocumentDir
}/react-native-executorch`;

function cachePathFor(url: string): string {
  const urlWithoutQuery = url.split('?')[0] ?? url;
  let hash = 5381;
  for (let i = 0; i < urlWithoutQuery.length; i++) {
    hash = (((hash << 5) + hash) ^ urlWithoutQuery.charCodeAt(i)) >>> 0;
  }
  const basename = urlWithoutQuery.split('/').pop() || 'model';
  return `${MODEL_DIRECTORY}/${hash}_${basename}`;
}

const state = {
  files: new Set<string>(),
  sizeByUri: new Map<string, number>(),
  statusByUri: new Map<string, number>(),
  sizeError: null as Error | null,
  existsError: null as Error | null,
  downloadError: null as Error | null,
  progressSteps: [0.5, 1] as number[],
  downloadCallCount: 0,
};

export function __mockResetModelFiles(): void {
  state.files.clear();
  state.sizeByUri.clear();
  state.statusByUri.clear();
  state.sizeError = null;
  state.existsError = null;
  state.downloadError = null;
  state.progressSteps = [0.5, 1];
  state.downloadCallCount = 0;
}

/** Marks these source URLs as already present on disk. */
export function __mockMarkDownloaded(...uris: string[]): void {
  for (const uri of uris) {
    state.files.add(cachePathFor(uri));
  }
}

export function __mockSetRemoteSize(uri: string, bytes: number): void {
  state.sizeByUri.set(uri, bytes);
}

/** The HTTP status the model host answers this URL's HEAD with (default 200). */
export function __mockSetRemoteStatus(uri: string, status: number): void {
  state.statusByUri.set(uri, status);
}

/** Makes the HEAD request itself fail, as with no network. */
export function __mockFailSizeProbe(error: Error): void {
  state.sizeError = error;
}

export function __mockFailExistsCheck(error: Error): void {
  state.existsError = error;
}

export function __mockFailDownload(error: Error): void {
  state.downloadError = error;
}

/** Downloads that actually had to fetch something — cache hits do not count. */
export function __mockDownloadCallCount(): number {
  return state.downloadCallCount;
}

/**
 * Backs the executorch `download` mock: fetches every remote URL in `urls`
 * that is not on disk yet and returns the local path of each.
 */
export async function __mockRunDownload(
  urls: string[],
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  if (urls.some((url) => !state.files.has(cachePathFor(url)))) {
    state.downloadCallCount += 1;
    for (const step of state.progressSteps) {
      onProgress?.(step);
    }
    // The transfer takes time: give a cancel issued meanwhile its chance.
    await Promise.resolve();
    if (signal?.aborted) {
      throw new Error('The download was aborted.');
    }
    if (state.downloadError) {
      throw state.downloadError;
    }
    for (const url of urls) {
      state.files.add(cachePathFor(url));
    }
  } else {
    onProgress?.(1);
  }
  return new Map(urls.map((url) => [url, cachePathFor(url)]));
}

const RNBlobUtil = {
  fs: {
    dirs,
    async exists(path: string): Promise<boolean> {
      if (state.existsError) {
        throw state.existsError;
      }
      return state.files.has(path);
    },
  },

  async fetch(method: string, url: string) {
    if (state.sizeError) {
      throw state.sizeError;
    }
    const status = state.statusByUri.get(url) ?? 200;
    const size = state.sizeByUri.get(url);
    const headers: Record<string, string> =
      method === 'HEAD' && status === 200 && size !== undefined
        ? { 'Content-Length': String(size) }
        : {};
    return { info: () => ({ status, headers }) };
  },
};

export default RNBlobUtil;
