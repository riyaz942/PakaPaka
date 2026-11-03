import { parseFurigana } from '@/core/furigana/parseFurigana';

/** Typed kana that turns into kanji on a grammar Build card (明日 for あした). */
export type KanjiConversion = { kana: string; kanji: string };

const HIRAGANA_RE = /^[ぁ-ゖ]$/;
const KANJI_RE = /[一-鿿々]/;

/**
 * One conversion per annotated run in the card's answers, so a converted
 * answer still matches the grader's slots. A one-kana reading (見[み]) is too
 * short to convert alone — き or み sit inside many other words — so it takes
 * the kana that follows it in the answer as context (みま → 見ま).
 */
export function buildKanjiConversions(furiganaAnswers: readonly string[]): KanjiConversion[] {
  const byKana = new Map<string, string>();
  for (const answer of furiganaAnswers) {
    const segments = parseFurigana(answer);
    segments.forEach((segment, index) => {
      if (!segment.reading) return;
      if (segment.reading.length >= 2) {
        if (!byKana.has(segment.reading)) byKana.set(segment.reading, segment.text);
        return;
      }
      const next = segments[index + 1];
      const context = (next?.reading ?? next?.text)?.[0];
      if (!context || !HIRAGANA_RE.test(context)) return;
      const kana = segment.reading + context;
      if (!byKana.has(kana)) byKana.set(kana, segment.text + context);
    });
  }
  return [...byKana].map(([kana, kanji]) => ({ kana, kanji }));
}

/** Where `next` differs from `prev`: [start, end) in `next`. */
function changedRange(prev: string, next: string): { start: number; end: number } {
  let start = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++;
  let tail = 0;
  while (
    tail < prev.length - start &&
    tail < next.length - start &&
    prev[prev.length - 1 - tail] === next[next.length - 1 - tail]
  ) {
    tail++;
  }
  return { start, end: next.length - tail };
}

/**
 * The conversions the learner undid in this edit: a deletion that removed
 * kanji one of them wrote. They stay off for the rest of the card, so typing
 * the kana again keeps the kana.
 */
export function undoneKanjiConversions(
  prev: string,
  next: string,
  conversions: readonly KanjiConversion[],
): string[] {
  const { start, end } = changedRange(prev, next);
  if (end > start) return [];
  const removed = prev.slice(start, start + prev.length - next.length);
  const removedKanji = [...removed].filter((ch) => KANJI_RE.test(ch));
  if (removedKanji.length === 0) return [];
  return conversions
    .filter((conversion) => removedKanji.some((ch) => conversion.kanji.includes(ch)))
    .map((conversion) => conversion.kana);
}

/**
 * Replaces conversion kana that this edit completed. Only text the edit
 * touched converts, so a deletion never converts and text already on screen is
 * left as the learner wrote it. Works the same for romaji turned into kana and
 * for kana typed on a Japanese keyboard.
 */
export function applyKanjiConversions(
  prev: string,
  next: string,
  conversions: readonly KanjiConversion[],
  disabled: ReadonlySet<string> = new Set(),
): string {
  const { start, end } = changedRange(prev, next);
  if (end <= start) return next;
  const active = conversions
    .filter((conversion) => !disabled.has(conversion.kana))
    .sort((a, b) => b.kana.length - a.kana.length);
  if (active.length === 0) return next;

  const longest = active[0].kana.length;
  let out = next.slice(0, Math.max(0, start - longest + 1));
  let i = out.length;
  while (i < next.length) {
    const match =
      i < end
        ? active.find(
            (conversion) => next.startsWith(conversion.kana, i) && i + conversion.kana.length > start,
          )
        : undefined;
    if (match) {
      out += match.kanji;
      i += match.kana.length;
    } else {
      out += next[i];
      i++;
    }
  }
  return out;
}
