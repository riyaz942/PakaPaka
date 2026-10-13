export type FuriganaSegment = {
  text: string;
  reading?: string;
};

const KANJI_MIN = 0x4e00;
const KANJI_MAX = 0x9fff;
/** 々 repeats the kanji before it and is annotated like one (時[とき]々[どき]). */
const KANJI_REPEAT_MARK = 0x3005;
const KANA_ONLY_RE = /^[぀-ヿ]*$/;
const TRAILING_PUNCTUATION_RE = /^[。、！？」』,.)）"'…～]$/;

function isKanji(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (code >= KANJI_MIN && code <= KANJI_MAX) || code === KANJI_REPEAT_MARK;
}

/** Validates balanced, non-nested `[reading]` brackets with kana-only readings. */
function isWellFormed(annotated: string): boolean {
  let inBracket = false;
  let readingStart = -1;

  for (let i = 0; i < annotated.length; i++) {
    const ch = annotated[i];
    if (ch === '[') {
      if (inBracket) {
        return false;
      }
      inBracket = true;
      readingStart = i + 1;
    } else if (ch === ']') {
      if (!inBracket) {
        return false;
      }
      const reading = annotated.slice(readingStart, i);
      if (!KANA_ONLY_RE.test(reading)) {
        return false;
      }
      inBracket = false;
    }
  }

  return !inBracket;
}

function mergeTrailingPunctuation(segments: FuriganaSegment[]): FuriganaSegment[] {
  const merged: FuriganaSegment[] = [];

  for (const segment of segments) {
    const isTrailingPunctuation =
      !segment.reading && segment.text.length === 1 && TRAILING_PUNCTUATION_RE.test(segment.text);

    const previous = merged.length > 0 ? merged[merged.length - 1] : null;

    // Never merge into an annotated run: the punctuation would sit under that
    // run's reading, and re-serialising the segment yields invalid notation
    // (`明日、[あした]`) that loses the reading on the next parse.
    if (isTrailingPunctuation && previous && !previous.reading) {
      merged[merged.length - 1] = { ...previous, text: previous.text + segment.text };
    } else {
      merged.push(segment);
    }
  }

  return merged;
}

/**
 * Parses JmdictFurigana bracket notation (`私[わたし]は学生[がくせい]です。`)
 * into display segments. Malformed input (unbalanced/nested brackets,
 * non-kana readings) degrades to a single unannotated segment holding the
 * raw string — this never throws, since it renders build-validated OTA
 * content but must stay defensive against unexpected data.
 *
 * Unannotated text is split into one segment per character (trailing
 * punctuation merged into the preceding segment) so the caller can lay
 * segments out as wrapping flex children.
 */
export function parseFurigana(annotated: string): FuriganaSegment[] {
  if (!annotated) {
    return [];
  }

  if (!isWellFormed(annotated)) {
    return [{ text: annotated }];
  }

  const segments: FuriganaSegment[] = [];
  const bracketRe = /\[([^[\]]*)]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = bracketRe.exec(annotated))) {
    const bracketStart = match.index;
    const reading = match[1];

    let runStart = bracketStart;
    while (runStart > cursor && isKanji(annotated[runStart - 1])) {
      runStart--;
    }

    for (let i = cursor; i < runStart; i++) {
      segments.push({ text: annotated[i] });
    }

    segments.push({ text: annotated.slice(runStart, bracketStart), reading });
    cursor = bracketStart + match[0].length;
  }

  for (let i = cursor; i < annotated.length; i++) {
    segments.push({ text: annotated[i] });
  }

  return mergeTrailingPunctuation(segments);
}
