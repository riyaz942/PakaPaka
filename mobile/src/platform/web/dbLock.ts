import type { AppError, Result } from '@/types/result.types';

/**
 * Web: one tab owns the OPFS databases. It holds this Web Lock for its whole
 * life; the BroadcastChannel between tabs uses the same name.
 */
export const TAB_COORDINATION_NAME = 'pakapaka-db';

/** How long a tab waits for the owner tab to answer (snapshot or release). */
export const TAB_ANSWER_TIMEOUT_MS = 5000;

export type DbLease = { release(): void };

/** Holds the lock until `release()`. The lock callback returns a promise that release resolves. */
function leaseFor(): { lease: DbLease; held: Promise<void> } {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { lease: { release }, held };
}

/** Takes the lock if no other tab holds it; `null` when another tab does. */
export function tryAcquireDbLock(): Promise<DbLease | null> {
  return new Promise((resolve) => {
    void navigator.locks.request(TAB_COORDINATION_NAME, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(null);
        return undefined;
      }
      const { lease, held } = leaseFor();
      resolve(lease);
      return held;
    });
  });
}

/** Waits in the lock queue; gives up after `timeoutMs` with `TAB_NOT_RESPONDING`. */
export function waitForDbLock(timeoutMs: number): Promise<Result<DbLease, AppError>> {
  const controller = new AbortController();
  return new Promise((resolve) => {
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    navigator.locks
      .request(TAB_COORDINATION_NAME, { signal: controller.signal }, () => {
        clearTimeout(timer);
        const { lease, held } = leaseFor();
        resolve({ ok: true, value: lease });
        return held;
      })
      .catch((cause: unknown) => {
        clearTimeout(timer);
        resolve({
          ok: false,
          error: {
            code: controller.signal.aborted ? 'TAB_NOT_RESPONDING' : 'DB_LOCK_ERROR',
            message: String(cause),
            cause,
          },
        });
      });
  });
}
