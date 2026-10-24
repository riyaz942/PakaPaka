import { LESSON_TYPE_LEAD } from '@/config/constants';

export type MixType = 'radical' | 'kanji' | 'vocabulary';

export type MixBucket = {
  type: MixType;
  /** Ready items of this type. */
  available: number;
  /** Unstarted items of this type in the level. */
  remaining: number;
};

const MIX_ORDER: readonly MixType[] = ['radical', 'kanji', 'vocabulary'];

/**
 * Splits `slots` across types by `lead × remaining` with randomized rounding:
 * each type gets the floor of its share, and only the leftover slots are drawn,
 * weighted by the fractional parts. A type moves at most one from its floor,
 * and never past what it has available.
 */
export function allocateTypeSlots(
  slots: number,
  buckets: MixBucket[],
  rng: () => number,
): Record<MixType, number> {
  const alloc: Record<MixType, number> = { radical: 0, kanji: 0, vocabulary: 0 };
  const byType = new Map(buckets.map((bucket) => [bucket.type, bucket] as const));
  const capacity = (type: MixType) => (byType.get(type)?.available ?? 0) - alloc[type];
  const total = () => alloc.radical + alloc.kanji + alloc.vocabulary;

  let left = slots;
  while (left > 0) {
    let open = MIX_ORDER.filter(
      (type) => capacity(type) > 0 && (byType.get(type)?.remaining ?? 0) > 0,
    );
    if (open.length === 0) break;

    const weights = open.map((type) => LESSON_TYPE_LEAD[type] * byType.get(type)!.remaining);
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    const quotas = new Map(open.map((type, i) => [type, (left * weights[i]) / weightSum] as const));

    for (const type of open) {
      alloc[type] += Math.min(Math.floor(quotas.get(type)!), capacity(type));
    }
    left = slots - total();
    if (left === 0) break;

    open = open.filter((type) => capacity(type) > 0);
    if (open.length === 0) break;

    const fracs = open.map((type) => {
      const q = quotas.get(type)!;
      return q - Math.floor(q) || 1e-9;
    });
    const r = rng() * fracs.reduce((sum, f) => sum + f, 0);
    let cumulative = 0;
    let pick = open[open.length - 1];
    for (let i = 0; i < open.length; i++) {
      cumulative += fracs[i];
      if (cumulative > r) {
        pick = open[i];
        break;
      }
    }
    alloc[pick] += 1;
    left -= 1;
  }
  return alloc;
}
