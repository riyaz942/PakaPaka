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
