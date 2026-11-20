/**
 * Lesson and review screens hold the gate while open. The curriculum swap waits
 * for it, so the database never closes under a session that is reading it.
 */
let holds = 0;
let waiters: (() => void)[] = [];

export function holdCurriculumSwap(): () => void {
  holds += 1;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    holds -= 1;
    if (holds === 0) {
      const toWake = waiters;
      waiters = [];
      toWake.forEach((wake) => wake());
    }
  };
}

export function isCurriculumSwapHeld(): boolean {
  return holds > 0;
}

export function waitForCurriculumSwapAllowed(): Promise<void> {
  if (holds === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiters.push(resolve);
  });
}

export function resetCurriculumSwapGateForTests(): void {
  holds = 0;
  waiters = [];
}
