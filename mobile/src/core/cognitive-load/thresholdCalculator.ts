import {
  COGNITIVE_LOAD_HISTORY_WINDOW,
  COGNITIVE_LOAD_THRESHOLD_ADAPTATION_GAIN,
  COGNITIVE_LOAD_THRESHOLD_BASE,
  COGNITIVE_LOAD_THRESHOLD_MAX,
  COGNITIVE_LOAD_THRESHOLD_MIN,
} from '@/config/constants';
import type { SessionIntensity } from './cognitiveLoad.types';

type ThresholdInput = {
  intensity: SessionIntensity;
  recentLoads: number[];
};

/**
 * Computes the adaptive daily cognitive load threshold.
 *
 * Formula:
 *   base = COGNITIVE_LOAD_THRESHOLD_BASE[intensity]
 *   if recentLoads is empty → return base (first session never zeroes out)
 *   rollingAvg = mean of up to COGNITIVE_LOAD_HISTORY_WINDOW prior daily loads
 *   adapted = (1 - GAIN) × base + GAIN × rollingAvg
 *   return clamp(adapted, MIN, MAX)
 *
 * Worked example (relaxed, base = 30, GAIN = 0.35):
 *   recentLoads = [45, 48, 50, 46, 44] → avg ≈ 46.6
 *   adapted = 0.65 × 30 + 0.35 × 46.6 ≈ 35.8
 */
export function computeThreshold(input: ThresholdInput): number {
  const base = COGNITIVE_LOAD_THRESHOLD_BASE[input.intensity];
  const windowed = input.recentLoads.slice(0, COGNITIVE_LOAD_HISTORY_WINDOW);

  if (windowed.length === 0) {
    return base;
  }

  const rollingAvg = windowed.reduce((sum, load) => sum + load, 0) / windowed.length;
  const gain = COGNITIVE_LOAD_THRESHOLD_ADAPTATION_GAIN;
  const adapted = (1 - gain) * base + gain * rollingAvg;

  return Math.min(
    COGNITIVE_LOAD_THRESHOLD_MAX,
    Math.max(COGNITIVE_LOAD_THRESHOLD_MIN, adapted),
  );
}
