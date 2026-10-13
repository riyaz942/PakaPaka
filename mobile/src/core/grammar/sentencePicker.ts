/**
 * Two distinct pool sentences for one grammar review — Read and Build — that
 * were not used in the previous review (D9). A sentence is keyed by its plain
 * Japanese (spec §5.1).
 *
 * Validator rule 4 guarantees ≥ 8 sentences per point, so with at most 2
 * excluded ≥ 6 remain. Fewer than 2 is a content error: it throws, and the
 * queue build reports it rather than reviewing with a repeated sentence.
 */
export function pickGrammarSentences<T extends { japanese: string }>(
  pool: readonly T[],
  lastKeys: readonly string[],
  rng: () => number = Math.random,
): { read: T; build: T } {
  const last = new Set(lastKeys);
  const candidates = pool.filter((sentence) => !last.has(sentence.japanese));
  if (candidates.length < 2) {
    throw new Error(
      `Grammar pool has ${candidates.length} unused sentence(s); need at least 2`,
    );
  }
  const readIndex = Math.floor(rng() * candidates.length);
  const read = candidates[readIndex];
  const rest = candidates.filter((_, index) => index !== readIndex);
  const build = rest[Math.floor(rng() * rest.length)];
  return { read, build };
}
