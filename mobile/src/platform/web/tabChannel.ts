import type { DbSnapshot } from '@/data/snapshotDatabases';
import { TAB_COORDINATION_NAME, waitForDbLock } from '@/platform/web/dbLock';
import type { AppError, Result } from '@/types/result.types';

/** Messages between PakaPaka tabs on the `pakapaka-db` BroadcastChannel (web). */
export type TabMessage =
  | { type: 'snapshot-request'; requestId: string }
  | { type: 'snapshot'; requestId: string; snapshot: DbSnapshot }
  | { type: 'release' };

function notResponding(): Result<never, AppError> {
  return {
    ok: false,
    error: { code: 'TAB_NOT_RESPONDING', message: 'The owner tab did not answer in time.' },
  };
}

function newRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Owner tab: answers each snapshot request, and calls `onRelease` when another
 * tab asks for the databases ("Use here"). A failed snapshot sends nothing;
 * the asking tab then times out. Returns a function that stops serving.
 */
export function serveOwnerTab(opts: {
  getSnapshot(): Promise<Result<DbSnapshot, AppError>>;
  onRelease(): void;
}): () => void {
  const channel = new BroadcastChannel(TAB_COORDINATION_NAME);
  let closed = false;

  channel.onmessage = (event: MessageEvent<TabMessage>) => {
    const message = event.data;
    if (message.type === 'snapshot-request') {
      void opts.getSnapshot().then((result) => {
        if (closed || !result.ok) {
          return;
        }
        const answer: TabMessage = {
          type: 'snapshot',
          requestId: message.requestId,
          snapshot: result.value,
        };
        channel.postMessage(answer);
      });
    } else if (message.type === 'release') {
      opts.onRelease();
    }
  };

  return () => {
    closed = true;
    channel.close();
  };
}

/** Browse-only tab: asks the owner for a copy of both databases. */
export function requestSnapshot(timeoutMs: number): Promise<Result<DbSnapshot, AppError>> {
  const requestId = newRequestId();
  const channel = new BroadcastChannel(TAB_COORDINATION_NAME);

  return new Promise((resolve) => {
    const finish = (result: Result<DbSnapshot, AppError>) => {
      clearTimeout(timer);
      channel.close();
      resolve(result);
    };
    const timer = setTimeout(() => finish(notResponding()), timeoutMs);

    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      const message = event.data;
      if (message.type === 'snapshot' && message.requestId === requestId) {
        finish({ ok: true, value: message.snapshot });
      }
    };
    const request: TabMessage = { type: 'snapshot-request', requestId };
    channel.postMessage(request);
  });
}

/**
 * "Use here": queues for the lock, asks the owner to let go, and returns ok
 * once the lock is free. The caller then reloads and starts as owner.
 */
export async function useHere(timeoutMs: number): Promise<Result<void, AppError>> {
  const lock = waitForDbLock(timeoutMs);

  const channel = new BroadcastChannel(TAB_COORDINATION_NAME);
  const release: TabMessage = { type: 'release' };
  channel.postMessage(release);
  channel.close();

  const result = await lock;
  if (!result.ok) {
    return result;
  }
  result.value.release();
  return { ok: true, value: undefined };
}
