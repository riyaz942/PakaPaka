/**
 * Multiple-choice distractor selection for apprentice grammar reviews (Plan 08).
 *
 * Distractors come from the same grammar family first (particles vs particles,
 * connectors vs connectors) so a wrong pick is a real confusion, not a
 * giveaway. Until curriculum families land everywhere (Plan 09), a hardcoded
 * particle pool covers the early N5 items and the caller may pass a fallback
 * pool from other grammar points.
 */

export const MC_OPTION_COUNT = 4;

/** Interim same-family pool for the early particles (Plan 08 §8.3). */
export const INTERIM_PARTICLE_POOL = [
  'は',
  'が',
  'を',
  'に',
  'で',
  'も',
  'へ',
  'と',
  'の',
  'か',
] as const;

export type PickGrammarDistractorsInput = {
  /** The correct chunk — never returned as a distractor. */
  answer: string;
  /** Same-family candidate chunks (curriculum family or interim pool). */
  familyCandidates: string[];
  /** Broader pool used only when family candidates run out. */
  fallbackPool?: string[];
  /** Number of distractors wanted (MC_OPTION_COUNT - 1 by default). */
  count?: number;
  /** Random source injected for deterministic tests. */
  rng?: () => number;
};

function sample(pool: string[], count: number, rng: () => number): string[] {
  const copy = [...pool];
  const picked: string[] = [];
  while (picked.length < count && copy.length > 0) {
    const index = Math.floor(rng() * copy.length);
    picked.push(copy.splice(index, 1)[0]);
  }
  return picked;
}

/**
 * Picks up to `count` distractors: family candidates first, then the fallback
 * pool. Empty strings, the correct answer, and duplicates are never included.
 * May return fewer than `count` when the pools are thin — the MC UI renders
 * whatever it gets (correct answer always present).
 */
export function pickGrammarDistractors(input: PickGrammarDistractorsInput): string[] {
  const count = input.count ?? MC_OPTION_COUNT - 1;
  const rng = input.rng ?? Math.random;

  const clean = (pool: string[], exclude: Set<string>): string[] => [
    ...new Set(pool.filter((form) => form.trim().length > 0 && !exclude.has(form))),
  ];

  const excluded = new Set([input.answer]);
  const family = clean(input.familyCandidates, excluded);
  const picked = sample(family, count, rng);

  if (picked.length < count && input.fallbackPool) {
    for (const form of picked) excluded.add(form);
    const fallback = clean(input.fallbackPool, excluded);
    picked.push(...sample(fallback, count - picked.length, rng));
  }

  return picked;
}

/**
 * Builds the shuffled on-card option list: correct answer + distractors.
 * Returns null when there are no distractors at all — an MC card with one
 * option is worse than type-in, so the caller should fall back to type_in.
 */
export function buildMcOptions(
  answer: string,
  distractors: string[],
  rng: () => number = Math.random,
): string[] | null {
  if (distractors.length === 0) return null;
  const options = [answer, ...distractors];
  // Fisher-Yates so the correct answer's position is uniform.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}
