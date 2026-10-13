import type { WordInflection } from '@/core/content/inflection';
import { parseFurigana, type FuriganaSegment } from '@/core/furigana/parseFurigana';

import type { PassageWordSpan } from '@/data/curriculum/passageSpans';

export type PassageBodyPart = {
  /** Non-null on a long-pressable span; null on inert interstitial text. */
  vocabularyItemId: string | null;
  /**
   * Bracket-annotated text for this run, ready to hand straight to
   * `FuriganaText` so the furigana toggle keeps working inside and outside
   * spans alike.
   */
  text: string;
  /** Plain surface form as it appears in the body, for a11y labels. */
  surface: string;
  /**
   * Which taught inflection the span is, when the surface is conjugated —
   * carried through so the detail surface can say "来ます is the ます-form of
   * 来る" (14.1). Null on dictionary-form spans and on inert text.
   */
  inflection: WordInflection | null;
  /** The grammar span of a grammar sentence (Read card highlight). Set only when true. */
  isGrammar?: true;
  /** A word span cut short by the grammar span (食べ of 食べた). Set only when true. */
  overlapsGrammar?: true;
};

function toAnnotated(segments: FuriganaSegment[]): string {
  return segments
    .map((segment) => (segment.reading ? `${segment.text}[${segment.reading}]` : segment.text))
    .join('');
}

function toSurface(segments: FuriganaSegment[]): string {
  return segments.map((segment) => segment.text).join('');
}

/**
 * Splits a passage body into alternating inert and long-pressable runs (FR70),
 * keeping furigana annotations intact.
 *
 * Spans are authored against the plain `body`, while readings live in the
 * bracket-annotated `bodyFurigana`. Both describe the same base text, so this
 * walks the parsed furigana segments and assigns each to the span it overlaps.
 *
 * A segment is atomic: an annotated run like `学生[がくせい]` is never cut in
 * half, because half a reading is not renderable. Authored spans are word
 * aligned, so in practice overlap means containment.
 */
export function buildPassageBodyParts(
  body: string,
  bodyFurigana: string | null,
  spans: PassageWordSpan[],
  grammarSpan?: { start: number; end: number },
): PassageBodyPart[] {
  const segments = parseFurigana(bodyFurigana ?? body);

  type Run = PassageWordSpan & { isGrammar?: true; overlapsGrammar?: true };

  const wordSpans: Run[] = spans.filter(
    (span) =>
      span.startOffset >= 0 &&
      span.endOffset <= body.length &&
      span.startOffset < span.endOffset,
  );

  // The grammar span wins over any word span it overlaps: the word keeps
  // only the part outside it, so the grammar is never hidden inside a link.
  let runs: Run[] = wordSpans;
  if (grammarSpan) {
    const { start, end } = grammarSpan;
    runs = [];
    for (const span of wordSpans) {
      if (span.endOffset <= start || span.startOffset >= end) {
        runs.push(span);
        continue;
      }
      if (span.startOffset < start) runs.push({ ...span, endOffset: start, overlapsGrammar: true });
      if (span.endOffset > end) runs.push({ ...span, startOffset: end, overlapsGrammar: true });
    }
    runs.push({ vocabularyItemId: '', startOffset: start, endOffset: end, isGrammar: true });
  }
  const validSpans = runs.sort((left, right) => left.startOffset - right.startOffset);

  const parts: PassageBodyPart[] = [];
  // Tracked by span identity, not id: two adjacent spans must stay separate
  // runs even when they point at the same vocabulary item.
  let runSpan: Run | null = null;
  let runSegments: FuriganaSegment[] = [];

  const flush = (): void => {
    if (runSegments.length === 0) return;
    parts.push({
      vocabularyItemId: runSpan && !runSpan.isGrammar ? runSpan.vocabularyItemId : null,
      text: toAnnotated(runSegments),
      surface: toSurface(runSegments),
      inflection: runSpan && !runSpan.isGrammar ? (runSpan.inflection ?? null) : null,
      ...(runSpan?.isGrammar ? { isGrammar: true as const } : {}),
      ...(runSpan?.overlapsGrammar ? { overlapsGrammar: true as const } : {}),
    });
    runSegments = [];
  };

  const push = (segment: FuriganaSegment, span: Run | null): void => {
    if (span !== runSpan) {
      flush();
      runSpan = span;
    }
    runSegments.push(segment);
  };

  let offset = 0;
  for (const segment of segments) {
    const segmentStart = offset;
    const segmentEnd = offset + segment.text.length;
    offset = segmentEnd;

    const overlapping = validSpans.filter(
      (candidate) => candidate.startOffset < segmentEnd && candidate.endOffset > segmentStart,
    );

    if (overlapping.length === 0) {
      push(segment, null);
      continue;
    }

    // An annotated run is atomic — half a reading is not renderable — so it
    // joins the first span it overlaps whole.
    if (segment.reading) {
      push(segment, overlapping[0]);
      continue;
    }

    // Unannotated text can be cut exactly on the span boundary, which keeps
    // trailing punctuation (merged into the segment by `parseFurigana`) out of
    // the pressable word.
    let cursor = segmentStart;
    for (const span of overlapping) {
      const spanStart = Math.max(span.startOffset, segmentStart);
      const spanEnd = Math.min(span.endOffset, segmentEnd);

      if (cursor < spanStart) {
        push({ text: segment.text.slice(cursor - segmentStart, spanStart - segmentStart) }, null);
      }
      push({ text: segment.text.slice(spanStart - segmentStart, spanEnd - segmentStart) }, span);
      cursor = spanEnd;
    }
    if (cursor < segmentEnd) {
      push({ text: segment.text.slice(cursor - segmentStart) }, null);
    }
  }

  flush();

  return parts;
}
