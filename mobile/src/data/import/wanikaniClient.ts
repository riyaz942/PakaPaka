import type { WaniKaniAssignment } from '@/core/import/import.types';
import type { AppError, Result } from '@/types/result.types';

const WANIKANI_API_BASE = 'https://api.wanikani.com/v2';
const DEFAULT_PAGE_SIZE = 500;
const MAX_RETRIES = 3;

type FetchLike = typeof fetch;
type SleepFn = (ms: number) => Promise<void>;

type WaniKaniCollection<T> = {
  object: string;
  pages?: {
    next_url?: string | null;
  };
  data: T[];
};

export type WaniKaniClientDeps = {
  fetchImpl?: FetchLike;
  sleep?: SleepFn;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRateLimitReset(headers: Headers): number | null {
  const resetHeader = headers.get('RateLimit-Reset');
  if (!resetHeader) {
    return null;
  }

  const resetSeconds = Number(resetHeader);
  if (!Number.isFinite(resetSeconds)) {
    return null;
  }

  const nowSeconds = Date.now() / 1000;
  // WaniKani-compatible behavior: handle both epoch-seconds and delta-seconds headers.
  if (resetSeconds > nowSeconds) {
    return resetSeconds * 1000;
  }

  return Date.now() + resetSeconds * 1000;
}

function networkError(message: string, userMessage: string, cause?: unknown): Result<never, AppError> {
  return {
    ok: false,
    error: {
      code: 'wanikani_network_error',
      message,
      userMessage,
      cause,
    },
  };
}

function authError(status: number): Result<never, AppError> {
  return {
    ok: false,
    error: {
      code: 'wanikani_invalid_key',
      message: `WaniKani API returned ${status}`,
      userMessage: 'Your WaniKani API key is invalid. Check the key and try again.',
    },
  };
}

function rateLimitError(): Result<never, AppError> {
  return {
    ok: false,
    error: {
      code: 'wanikani_rate_limited',
      message: 'WaniKani rate limit exceeded',
      userMessage: 'WaniKani rate limit reached. Please wait a moment and try again.',
    },
  };
}

function serverError(status: number): Result<never, AppError> {
  return {
    ok: false,
    error: {
      code: 'wanikani_server_error',
      message: `WaniKani API returned ${status}`,
      userMessage: 'WaniKani is temporarily unavailable. Please try again later.',
    },
  };
}

export class WaniKaniClient {
  private readonly fetchImpl: FetchLike;
  private readonly sleep: SleepFn;
  private rateLimitRemaining: number | null = null;
  private rateLimitResetAtMs: number | null = null;

  constructor(
    private readonly apiKey: string,
    deps: WaniKaniClientDeps = {},
  ) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.sleep = deps.sleep ?? defaultSleep;
  }

  async fetchAllAssignments(): Promise<Result<WaniKaniAssignment[], AppError>> {
    const assignments: WaniKaniAssignment[] = [];
    let nextUrl: string | null = `${WANIKANI_API_BASE}/assignments?limit=${DEFAULT_PAGE_SIZE}`;

    while (nextUrl) {
      const pageResult: Result<{ data: WaniKaniAssignment[]; nextUrl: string | null }, AppError> =
        await this.fetchCollection<WaniKaniAssignment>(nextUrl);
      if (!pageResult.ok) {
        return pageResult;
      }

      assignments.push(...pageResult.value.data);
      nextUrl = pageResult.value.nextUrl;
    }

    return { ok: true, value: assignments };
  }

  private async fetchCollection<T>(
    url: string,
    attempt = 0,
  ): Promise<Result<{ data: T[]; nextUrl: string | null }, AppError>> {
    await this.waitForRateLimit();

    try {
      const response = await this.fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Wanikani-Revision': '20170710',
        },
      });

      this.updateRateLimitFromHeaders(response.headers);

      if (response.status === 401 || response.status === 403) {
        return authError(response.status);
      }

      if (response.status === 429) {
        if (attempt >= MAX_RETRIES) {
          return rateLimitError();
        }

        await this.waitForRateLimit(true);
        return this.fetchCollection(url, attempt + 1);
      }

      if (response.status >= 500) {
        if (attempt >= MAX_RETRIES) {
          return serverError(response.status);
        }

        await this.sleep(500 * (attempt + 1));
        return this.fetchCollection(url, attempt + 1);
      }

      if (!response.ok) {
        return {
          ok: false,
          error: {
            code: 'wanikani_request_failed',
            message: `WaniKani API returned ${response.status}`,
            userMessage: 'Could not import from WaniKani. Please try again.',
          },
        };
      }

      const payload = (await response.json()) as WaniKaniCollection<{ object: string; data: T }>;
      const data = payload.data.map((entry) => entry.data);
      const nextUrl = payload.pages?.next_url ?? null;

      return { ok: true, value: { data, nextUrl } };
    } catch (cause) {
      if (attempt >= MAX_RETRIES) {
        return networkError(
          'WaniKani network request failed',
          'Could not reach WaniKani. Check your connection and try again.',
          cause,
        );
      }

      await this.sleep(500 * (attempt + 1));
      return this.fetchCollection(url, attempt + 1);
    }
  }

  private updateRateLimitFromHeaders(headers: Headers): void {
    const remainingHeader = headers.get('RateLimit-Remaining');
    if (remainingHeader !== null) {
      const remaining = Number(remainingHeader);
      if (Number.isFinite(remaining)) {
        this.rateLimitRemaining = remaining;
      }
    }

    const resetAtMs = parseRateLimitReset(headers);
    if (resetAtMs !== null) {
      this.rateLimitResetAtMs = resetAtMs;
    }
  }

  private async waitForRateLimit(force = false): Promise<void> {
    if (!force && (this.rateLimitRemaining === null || this.rateLimitRemaining > 0)) {
      return;
    }

    if (this.rateLimitResetAtMs === null) {
      await this.sleep(1000);
      return;
    }

    const waitMs = Math.max(0, this.rateLimitResetAtMs - Date.now());
    if (waitMs > 0) {
      await this.sleep(waitMs);
    }
  }
}

export async function fetchWaniKaniAssignments(
  apiKey: string,
  deps: WaniKaniClientDeps = {},
): Promise<Result<WaniKaniAssignment[], AppError>> {
  const client = new WaniKaniClient(apiKey, deps);
  return client.fetchAllAssignments();
}
