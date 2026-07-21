/**
 * Mock for `expo/fetch` — the streaming fetch used by the AI adapters.
 *
 * Tests queue whole SSE bodies with `__mockEnqueueSseResponse`; the mock hands
 * them back one `Uint8Array` chunk per call so the client's block-buffering is
 * genuinely exercised rather than short-circuited by one giant chunk.
 */

type MockResponse = {
  ok: boolean;
  status: number;
  chunks: string[];
  errorBody: string;
  /** Throw partway through the stream, to exercise the partial-failure path. */
  throwAfterChunks?: number;
};

type MockCall = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

const queue: MockResponse[] = [];
const calls: MockCall[] = [];
let networkError: Error | null = null;

export function __mockResetFetch(): void {
  queue.length = 0;
  calls.length = 0;
  networkError = null;
}

/** Queue a successful SSE stream. Each entry becomes one wire chunk. */
export function __mockEnqueueSseResponse(chunks: string[]): void {
  queue.push({ ok: true, status: 200, chunks, errorBody: '' });
}

/** Queue a stream that fails partway, after `throwAfterChunks` chunks. */
export function __mockEnqueueSseFailure(chunks: string[], throwAfterChunks: number): void {
  queue.push({ ok: true, status: 200, chunks, errorBody: '', throwAfterChunks });
}

/** Queue a non-2xx response. */
export function __mockEnqueueHttpError(status: number, errorBody = ''): void {
  queue.push({ ok: false, status, chunks: [], errorBody });
}

/** Make the next call reject at the transport level. */
export function __mockSetNetworkError(error: Error | null): void {
  networkError = error;
}

export function __mockGetFetchCalls(): MockCall[] {
  return calls.map((call) => ({ ...call }));
}

export async function fetch(url: string, init: RequestInit) {
  calls.push({
    url,
    headers: (init.headers ?? {}) as Record<string, string>,
    body: String(init.body ?? ''),
  });

  if (networkError) {
    const error = networkError;
    networkError = null;
    throw error;
  }

  const queued = queue.shift();
  if (!queued) {
    throw new Error(`expo/fetch mock: no response queued for ${url}`);
  }

  if (!queued.ok) {
    return {
      ok: false,
      status: queued.status,
      body: null,
      text: async () => queued.errorBody,
    };
  }

  const encoder = new TextEncoder();
  let index = 0;

  return {
    ok: true,
    status: queued.status,
    text: async () => queued.chunks.join(''),
    body: {
      getReader() {
        return {
          async read() {
            if (
              queued.throwAfterChunks !== undefined &&
              index >= queued.throwAfterChunks
            ) {
              throw new Error('stream interrupted');
            }
            if (index >= queued.chunks.length) {
              return { done: true, value: undefined };
            }
            const chunk = queued.chunks[index];
            index += 1;
            return { done: false, value: encoder.encode(chunk) };
          },
        };
      },
    },
  };
}
