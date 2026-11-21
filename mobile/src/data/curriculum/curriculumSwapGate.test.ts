import {
  holdCurriculumSwap,
  isCurriculumSwapHeld,
  resetCurriculumSwapGateForTests,
  waitForCurriculumSwapAllowed,
} from '@/data/curriculum/curriculumSwapGate';

async function settles(promise: Promise<void>): Promise<boolean> {
  let done = false;
  void promise.then(() => {
    done = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  return done;
}

describe('curriculumSwapGate', () => {
  beforeEach(() => resetCurriculumSwapGateForTests());

  it('not held: wait resolves at once', async () => {
    expect(isCurriculumSwapHeld()).toBe(false);
    expect(await settles(waitForCurriculumSwapAllowed())).toBe(true);
  });

  it('held: wait resolves only after release', async () => {
    const release = holdCurriculumSwap();
    expect(isCurriculumSwapHeld()).toBe(true);

    const waiting = waitForCurriculumSwapAllowed();
    expect(await settles(waiting)).toBe(false);

    release();
    expect(isCurriculumSwapHeld()).toBe(false);
    expect(await settles(waiting)).toBe(true);
  });

  it('two holds: resolves after both release', async () => {
    const first = holdCurriculumSwap();
    const second = holdCurriculumSwap();
    const waiting = waitForCurriculumSwapAllowed();

    first();
    expect(await settles(waiting)).toBe(false);

    second();
    expect(await settles(waiting)).toBe(true);
  });

  it('calling one release twice counts once', async () => {
    const first = holdCurriculumSwap();
    holdCurriculumSwap();

    first();
    first();
    expect(isCurriculumSwapHeld()).toBe(true);
  });
});
