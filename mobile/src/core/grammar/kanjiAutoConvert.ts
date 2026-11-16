import { parseFurigana, type FuriganaSegment } from '@/core/furigana/parseFurigana';

/** Typed kana that turns into kanji on a grammar Build card (明日 for あした). */
export type KanjiConversion = { kana: string; kanji: string };

const HIRAGANA_RE = /^[ぁ-ゖ]$/;
const KANJI_RE = /[一-鿿々]/;

/**
 * One conversion per annotated run in the card's answers, so a converted
 * answer still matches the grader's slots. A one-kana reading (見[み]) is too
 * short to convert alone — き or み sit inside many other words — so it takes
 * the kana that follows it in the answer as context (みま → 見ま). Annotated
 * runs with no kana between them (会[かい]社[しゃ]) also give one whole-word
 * conversion, so applyKanjiConversions can wait for かいしゃ instead of
 * converting かい.
 */
export function buildKanjiConversions(furiganaAnswers: readonly string[]): KanjiConversion[] {
  const byKana = new Map<string, string>();
  for (const answer of furiganaAnswers) {
    const segments = parseFurigana(answer);
    for (const word of joinedRuns(segments)) {
      if (!byKana.has(word.kana)) byKana.set(word.kana, word.kanji);
    }
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

/** Two or more annotated runs in a row, joined into one conversion. */
function joinedRuns(segments: readonly FuriganaSegment[]): KanjiConversion[] {
  const words: KanjiConversion[] = [];
  let word: KanjiConversion = { kana: '', kanji: '' };
  let runs = 0;
  for (const segment of [...segments, { text: '' }]) {
    if (segment.reading) {
      word = { kana: word.kana + segment.reading, kanji: word.kanji + segment.text };
      runs++;
      continue;
    }
    if (runs >= 2) words.push(word);
    word = { kana: '', kanji: '' };
    runs = 0;
  }
  return words;
}

/** Romaji the learner has not finished (かいsh), not yet kana. */
const TRAILING_ROMAJI_RE = /[a-z']+$/i;

/**
 * True when `text` (to the end of the input) is the start of a longer
 * conversion, so the learner may still be typing that word.
 */
function mayGrow(text: string, conversions: readonly KanjiConversion[]): boolean {
  const typed = text.replace(TRAILING_ROMAJI_RE, '');
  return (
    typed.length > 0 &&
    conversions.some((conversion) => conversion.kana.length > typed.length && conversion.kana.startsWith(typed))
  );
}

/** Start of the kana at the end of `text` that was waiting for a longer word. */
function waitingStart(text: string, conversions: readonly KanjiConversion[], longest: number): number {
  for (let i = Math.max(0, text.length - longest); i < text.length; i++) {
    if (mayGrow(text.slice(i), conversions)) return i;
  }
  return text.length;
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
 * True when this edit typed Latin letters: romaji from an English keyboard.
 * A Japanese keyboard sends kana or its own kanji, and picks kanji itself.
 */
export function typedRomaji(prev: string, raw: string): boolean {
  const { start, end } = changedRange(prev, raw);
  return /[a-z]/i.test(raw.slice(start, end));
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
 * left as the learner wrote it. Kana at the end of the input that may still
 * grow into a longer word waits, like a phone IME. WanaKanaInput calls it for
 * romaji typing only (typedRomaji).
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
  // Kana held back for a longer word (かい for かいしゃ) converts once this
  // edit shows which word it is.
  const waiting = Math.min(waitingStart(prev, active, longest), start);
  let out = next.slice(0, Math.max(0, Math.min(start - longest + 1, waiting)));
  let i = out.length;
  while (i < next.length) {
    if (i < end && mayGrow(next.slice(i), active)) {
      out += next.slice(i);
      break;
    }
    const match =
      i < end
        ? active.find(
            (conversion) =>
              next.startsWith(conversion.kana, i) &&
              (i >= waiting || i + conversion.kana.length > start),
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
