import { useEffect, useRef, useState } from 'react';

import { FILL_SPRING } from '@/constants/motion';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';

/** Natural frequency of FILL_SPRING, in rad/s. */
const OMEGA = Math.sqrt(FILL_SPRING.stiffness / FILL_SPRING.mass);

/**
 * Share of the way to the target after `seconds`, on a critically damped
 * spring — the same curve the bars and rings fill on.
 */
function springProgress(seconds: number): number {
  return 1 - (1 + OMEGA * seconds) * Math.exp(-OMEGA * seconds);
}

/**
 * A whole number that counts from its last value up (or down) to `target`
 * on the fill spring, for headline stats. Shows `target` at once under reduced
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
      const progress = springProgress((Date.now() - start) / 1000);
      const next = Math.round(from + (target - from) * progress);
      setShown(next);
      if (next !== target) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, reducedMotion]);

  return shown;
}
