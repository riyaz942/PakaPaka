import type { PassageWordSpan } from '@/data/curriculum/passageSpans';

export type ExampleSentenceVocabLink = {
  itemId: string;
  primaryForm: string;
};

/**
 * Locates pressable spans by matching each linked vocab's `primaryForm` in the
 * sentence (Plan 11.6). Longer forms win on overlap (私 vs 私たち). Unmatched
 * links stay inert — never auto-segmented.
 */
export function buildExampleSentenceSpans(
  japanese: string,
  links: ExampleSentenceVocabLink[],
): PassageWordSpan[] {
  const sorted = [...links].sort(
    (left, right) =>
      right.primaryForm.length - left.primaryForm.length ||
      left.itemId.localeCompare(right.itemId),
  );

  const claimed: { start: number; end: number }[] = [];
  const spans: PassageWordSpan[] = [];

  for (const link of sorted) {
    if (!link.primaryForm) continue;

    let from = 0;
    while (from < japanese.length) {
      const start = japanese.indexOf(link.primaryForm, from);
      if (start < 0) break;

      const end = start + link.primaryForm.length;
      const overlaps = claimed.some((range) => start < range.end && end > range.start);
      if (!overlaps) {
        claimed.push({ start, end });
        spans.push({
          vocabularyItemId: link.itemId,
          startOffset: start,
          endOffset: end,
        });
        break;
      }
      from = start + 1;
    }
  }

  return spans.sort((left, right) => left.startOffset - right.startOffset);
}
