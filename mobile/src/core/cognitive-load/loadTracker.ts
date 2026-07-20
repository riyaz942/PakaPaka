import {
  COGNITIVE_LOAD_MATURITY_MULTIPLIER,
  COGNITIVE_LOAD_WEIGHTS,
  INCORRECT_LOAD_SURCHARGE,
} from '@/config/constants';
import type { SRSStageLabel } from '@/core/srs/srs.types';

import type { LoadOutcome } from './cognitiveLoad.types';

type LoadIncrementInput = {
  itemType: keyof typeof COGNITIVE_LOAD_WEIGHTS;
  stageLabel: SRSStageLabel;
  outcome: LoadOutcome;
};

export function computeLoadIncrement(input: LoadIncrementInput): number {
  const base = COGNITIVE_LOAD_WEIGHTS[input.itemType];
  const maturity = COGNITIVE_LOAD_MATURITY_MULTIPLIER[input.stageLabel] ?? COGNITIVE_LOAD_MATURITY_MULTIPLIER.apprentice;
  if (__DEV__ && COGNITIVE_LOAD_MATURITY_MULTIPLIER[input.stageLabel] === undefined) {
    console.warn('[loadTracker] unrecognised stageLabel:', input.stageLabel, '— defaulting to apprentice multiplier');
  }
  const surcharge = input.outcome === 'incorrect' ? INCORRECT_LOAD_SURCHARGE : 1;
  return base * maturity * surcharge;
}

/**
 * Percent of the daily goal achieved. Deliberately unclamped above 100 —
 * overshoot is celebrated (FR55), never capped. Floored at 0.
 */
export function computeLoadPercent(load: number, threshold: number): number {
  if (threshold <= 0) {
    return 0;
  }
  const raw = (load / threshold) * 100;
  return Math.round(Math.max(0, raw));
}
