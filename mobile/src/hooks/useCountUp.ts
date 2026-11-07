import { useEffect, useRef, useState } from 'react';

import { useReducedMotion } from '@/data/hooks/useReducedMotion';

const COUNT_UP_MS = 700;

/**
 * A whole number that counts from its last value up (or down) to `target`
 * with an ease-out, for headline stats. Shows `target` at once under reduced
 * motion.
 */
export function useCountUp(target: number): number {
  const { reducedMotion } = useReducedMotion();
  const [shown, setShown] = useState(reducedMotion ? target : 0);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    if (reducedMotion) {
      setShown(target);
      return;
    }
    const from = shownRef.current;
    if (from === target) return;

    const start = Date.now();
    let frame = requestAnimationFrame(function step() {
      const t = Math.min(1, (Date.now() - start) / COUNT_UP_MS);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, reducedMotion]);

  return shown;
}
