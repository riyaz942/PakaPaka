/**
 * Fakes for the Web Locks API and BroadcastChannel, close to browser behaviour:
 * - a lock is held until the callback's promise settles; queued requests wait
 *   and reject with AbortError when their signal aborts;
 * - a channel delivers to every other open channel with the same name (not to
 *   the sender), asynchronously.
 */

type Waiter = {
  callback: (lock: { name: string } | null) => unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

export class FakeLockManager {
  private held = new Set<string>();
  private queues = new Map<string, Waiter[]>();

  request(
    name: string,
    options: { ifAvailable?: boolean; signal?: AbortSignal },
    callback: (lock: { name: string } | null) => unknown,
  ): Promise<unknown> {
    if (options.signal?.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }
    if (!this.held.has(name)) {
      return this.grant(name, callback);
    }
    if (options.ifAvailable) {
      return Promise.resolve().then(() => callback(null));
    }
    return new Promise((resolve, reject) => {
      const waiter: Waiter = { callback, resolve, reject };
      const queue = this.queues.get(name) ?? [];
      queue.push(waiter);
      this.queues.set(name, queue);
      options.signal?.addEventListener('abort', () => {
        const current = this.queues.get(name) ?? [];
        const index = current.indexOf(waiter);
        if (index >= 0) {
          current.splice(index, 1);
          reject(new DOMException('Aborted', 'AbortError'));
        }
      });
    });
  }

  isHeld(name: string): boolean {
    return this.held.has(name);
  }

  private grant(name: string, callback: Waiter['callback']): Promise<unknown> {
    this.held.add(name);
    return Promise.resolve()
      .then(() => callback({ name }))
      .finally(() => {
        this.held.delete(name);
        const next = this.queues.get(name)?.shift();
        if (next) {
          this.grant(name, next.callback).then(next.resolve, next.reject);
        }
      });
  }
}

export class FakeBroadcastChannel {
  static open = new Set<FakeBroadcastChannel>();
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;

  constructor(readonly name: string) {
    FakeBroadcastChannel.open.add(this);
  }

  postMessage(data: unknown): void {
    if (this.closed) {
      throw new DOMException('Channel is closed', 'InvalidStateError');
    }
    const targets = [...FakeBroadcastChannel.open].filter(
      (channel) => channel !== this && channel.name === this.name,
    );
    for (const target of targets) {
      void Promise.resolve().then(() => {
        if (!target.closed) {
          target.onmessage?.({ data });
        }
      });
    }
  }

  close(): void {
    this.closed = true;
    FakeBroadcastChannel.open.delete(this);
  }
}

/** Installs fresh fakes on `navigator.locks` and `BroadcastChannel`; returns the lock manager. */
export function installWebTabFakes(): FakeLockManager {
  const locks = new FakeLockManager();
  FakeBroadcastChannel.open.clear();
  Object.defineProperty(globalThis.navigator, 'locks', { value: locks, configurable: true });
  (globalThis as unknown as { BroadcastChannel: unknown }).BroadcastChannel =
    FakeBroadcastChannel;
  return locks;
}
