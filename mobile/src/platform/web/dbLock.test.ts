import { installWebTabFakes, type FakeLockManager } from '@/test-support/webTabFakes';
import {
  TAB_COORDINATION_NAME,
  tryAcquireDbLock,
  waitForDbLock,
} from '@/platform/web/dbLock';

describe('dbLock', () => {
  let locks: FakeLockManager;

  beforeEach(() => {
    locks = installWebTabFakes();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('tryAcquireDbLock returns a lease when the lock is free and null when held', async () => {
    const first = await tryAcquireDbLock();
    expect(first).not.toBeNull();
    expect(locks.isHeld(TAB_COORDINATION_NAME)).toBe(true);

    const second = await tryAcquireDbLock();
    expect(second).toBeNull();
  });

  it('release lets a waiting waitForDbLock resolve ok', async () => {
    const owner = await tryAcquireDbLock();
    const waiting = waitForDbLock(5000);

    owner!.release();
    const result = await waiting;

    expect(result.ok).toBe(true);
    expect(locks.isHeld(TAB_COORDINATION_NAME)).toBe(true);
    if (result.ok) result.value.release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(locks.isHeld(TAB_COORDINATION_NAME)).toBe(false);
  });

  it('waitForDbLock returns TAB_NOT_RESPONDING after the timeout and aborts the request', async () => {
    jest.useFakeTimers();
    const owner = await tryAcquireDbLock();
    const waiting = waitForDbLock(5000);

    await jest.advanceTimersByTimeAsync(5000);
    const result = await waiting;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TAB_NOT_RESPONDING');

    // The aborted request must not take the lock later.
    owner!.release();
    await jest.advanceTimersByTimeAsync(0);
    expect(locks.isHeld(TAB_COORDINATION_NAME)).toBe(false);
    expect(await tryAcquireDbLock()).not.toBeNull();
  });
});
