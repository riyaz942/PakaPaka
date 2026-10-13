export type GrammarCardKind = 'read' | 'build';

/**
 * D12 — when a vocabulary word on a grammar card opens its detail page.
 * Read: always (the grammar span has its own lock). Build: a word the learner
 * has started only after answering (before, its detail would hand over the
 * sentence); a word not started yet links at once, with no grade penalty.
 */
export function isWordLinked({
  card,
  answered,
  wordStarted,
}: {
  card: GrammarCardKind;
  answered: boolean;
  wordStarted: boolean;
}): boolean {
  if (card === 'read') return true;
  return answered || !wordStarted;
}
