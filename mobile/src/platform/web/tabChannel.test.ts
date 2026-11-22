import type { DbSnapshot } from '@/data/snapshotDatabases';
import { tryAcquireDbLock, TAB_COORDINATION_NAME } from '@/platform/web/dbLock';
import { requestSnapshot, serveOwnerTab, useHere } from '@/platform/web/tabChannel';
import {
  FakeBroadcastChannel,
  installWebTabFakes,
  type FakeLockManager,
} from '@/test-support/webTabFakes';

const SNAPSHOT: DbSnapshot = {
  curriculum: new Uint8Array([1, 2, 3]),
  user: new Uint8Array([4, 5]),
};

describe('tabChannel', () => {
  let locks: FakeLockManager;
  const stops: (() => void)[] = [];

  beforeEach(() => {
    locks = installWebTabFakes();
  });

  afterEach(() => {
    stops.splice(0).forEach((stop) => stop());
    jest.useRealTimers();
  });

  it('serveOwnerTab answers a snapshot-request with the same requestId', async () => {
    stops.push(
      serveOwnerTab({
        getSnapshot: async () => ({ ok: true, value: SNAPSHOT }),
        onRelease: jest.fn(),
      }),
    );
    const listener = new FakeBroadcastChannel(TAB_COORDINATION_NAME);
    const received: unknown[] = [];
    listener.onmessage = (event) => received.push(event.data);
    const sender = new FakeBroadcastChannel(TAB_COORDINATION_NAME);

    sender.postMessage({ type: 'snapshot-request', requestId: 'r-1' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(received).toContainEqual({ type: 'snapshot', requestId: 'r-1', snapshot: SNAPSHOT });
    listener.close();
    sender.close();
  });

  it('serveOwnerTab sends nothing when getSnapshot fails', async () => {
    stops.push(
      serveOwnerTab({
        getSnapshot: async () => ({ ok: false, error: { code: 'X', message: 'x' } }),
        onRelease: jest.fn(),
      }),
    );
    const listener = new FakeBroadcastChannel(TAB_COORDINATION_NAME);
    const received: unknown[] = [];
    listener.onmessage = (event) => received.push(event.data);
    const sender = new FakeBroadcastChannel(TAB_COORDINATION_NAME);

    sender.postMessage({ type: 'snapshot-request', requestId: 'r-1' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(received.filter((m) => (m as { type: string }).type === 'snapshot')).toEqual([]);
    listener.close();
    sender.close();
  });

  it('requestSnapshot resolves with the owner snapshot', async () => {
    stops.push(
      serveOwnerTab({
        getSnapshot: async () => ({ ok: true, value: SNAPSHOT }),
        onRelease: jest.fn(),
      }),
    );

    const result = await requestSnapshot(5000);

    expect(result).toEqual({ ok: true, value: SNAPSHOT });
  });

  it('requestSnapshot ignores answers for other request ids', async () => {
    jest.useFakeTimers();
    const fakeOwner = new FakeBroadcastChannel(TAB_COORDINATION_NAME);
    fakeOwner.onmessage = (event) => {
      const message = event.data as { type: string; requestId: string };
      if (message.type === 'snapshot-request') {
        fakeOwner.postMessage({ type: 'snapshot', requestId: 'someone-else', snapshot: SNAPSHOT });
      }
    };

    const pending = requestSnapshot(5000);
    await jest.advanceTimersByTimeAsync(5000);
    const result = await pending;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TAB_NOT_RESPONDING');
    fakeOwner.close();
  });

  it('requestSnapshot returns TAB_NOT_RESPONDING after 5000 ms', async () => {
    jest.useFakeTimers();
    let settled = false;
    const pending = requestSnapshot(5000).then((result) => {
      settled = true;
      return result;
    });

    await jest.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TAB_NOT_RESPONDING');
    expect(FakeBroadcastChannel.open.size).toBe(0);
  });

  it('serveOwnerTab calls onRelease on a release message', async () => {
    const onRelease = jest.fn();
    stops.push(
      serveOwnerTab({ getSnapshot: async () => ({ ok: true, value: SNAPSHOT }), onRelease }),
    );
    const sender = new FakeBroadcastChannel(TAB_COORDINATION_NAME);

    sender.postMessage({ type: 'release' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onRelease).toHaveBeenCalledTimes(1);
    sender.close();
  });

  it('useHere succeeds when no owner exists', async () => {
    const result = await useHere(5000);

    expect(result.ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(locks.isHeld(TAB_COORDINATION_NAME)).toBe(false);
  });

  it('useHere asks the owner to release, then gets the lock', async () => {
    const lease = await tryAcquireDbLock();
    const onRelease = jest.fn(() => lease!.release());
    stops.push(
      serveOwnerTab({ getSnapshot: async () => ({ ok: true, value: SNAPSHOT }), onRelease }),
    );

    const result = await useHere(5000);

    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });

  it('useHere returns TAB_NOT_RESPONDING when the owner keeps the lock', async () => {
    jest.useFakeTimers();
    await tryAcquireDbLock();

    const pending = useHere(5000);
    await jest.advanceTimersByTimeAsync(5000);
    const result = await pending;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TAB_NOT_RESPONDING');
  });
});
