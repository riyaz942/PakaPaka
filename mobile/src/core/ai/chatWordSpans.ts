import type { WordInflection } from '@/core/content/inflection';
import { parseFurigana } from '@/core/furigana/parseFurigana';
import type { PassageWordSpan } from '@/data/curriculum/passageSpans';

/**
 * Per-word curriculum linking for AI replies (Plan 15.1).
 *
 * Passages and example sentences get their spans from the curriculum pipeline,
 * which has unidic and a build step. A chat reply has neither — it is generated
 * live — so the question 15.1 had to answer was where word boundaries come from
 * without shipping a tokenizer.
 *
 * They come from the reply itself. The AI is prompted to emit the curriculum's
 * furigana bracket notation, so every kanji run in a reply arrives explicitly
 * delimited (`私[わたし]は学生[がくせい]です`). Those runs are the **anchors**:
 * a match may only start at one, and grows rightwards over the kana that
 * follow. This is the same premise `extractWordCandidates` already relies on for
 * the lookup sheet, and it is what keeps the runtime honest — kana-only
 * stretches (ある, これ, きれい) are never segmented, because nothing in the text
 * marks where they begin.
 *
 * What a grown candidate is checked against is the curriculum surface index
 * (`getChatWordIndex`): dictionary forms, plus the taught-inflection surfaces
 * 14.1a already derived at build time. So 食[た]べました links to 食べる and is
 * labelled as its ます-form without the app conjugating anything.
 *
 * Anything that does not match stays inert plain text — an off-curriculum word,
 * or a form the learner has not been taught (a potential, a volitional), is
 * simply not underlined. Those are what the "Look up words" sheet is for, which
 * is why it stays: the underline means "this is a word you are being taught",
 * and the sheet covers everything else, translation included.
 */

/** What one curriculum surface resolves to. `inflection` is null on dictionary forms. */
export type ChatWordEntry = {
  itemId: string;
  inflection: WordInflection | null;
};

/** Surface form → curriculum item. Built once per curriculum db by `getChatWordIndex`. */
export type ChatWordIndex = ReadonlyMap<string, ChatWordEntry>;

/**
 * Longest candidate a match is attempted for, in characters. The shipped
 * curriculum's longest entry is 8 (バスケットボール, 降りませんでした); the slack
 * covers longer polite negatives a later level may add (勉強しませんでした) while
 * keeping the per-anchor work bounded.
 */
const MAX_CANDIDATE_LENGTH = 12;

/**
 * Characters a match may grow over once it has started: kana (with ー and the
 * iteration marks) for okurigana and particles that belong to the entry, and
 * kanji for a compound whose runs the model annotated separately
 * (日[に]本[ほん]語[ご] is still 日本語). Punctuation, latin, digits and
 * whitespace end the candidate — a span must never swallow 。 or a space.
 */
const WORD_TAIL_RE = /^[々〻ぁ-ゟ゠-ヿ一-鿿]$/u;

/**
 * A unit is the smallest piece a span boundary may fall on: a whole annotated
 * run (half a reading is not renderable — `buildPassageBodyParts` treats those
 * as atomic) or a single unannotated character.
 */
type Unit = {
  start: number;
  end: number;
  /** Annotated runs are the only positions a match may start at. */
  isAnchor: boolean;
  /** Whether a match already underway may grow over this unit. */
  isTail: boolean;
};

function buildUnits(annotated: string): Unit[] {
  const units: Unit[] = [];
  let offset = 0;

  for (const segment of parseFurigana(annotated)) {
    if (segment.reading) {
      units.push({
        start: offset,
        end: offset + segment.text.length,
        isAnchor: true,
        isTail: true,
      });
      offset += segment.text.length;
      continue;
    }
    // `parseFurigana` merges trailing punctuation into the preceding
    // unannotated segment, so split per character and let WORD_TAIL_RE decide
    // rather than trusting the segment to be one character of word text.
    for (const character of segment.text) {
      units.push({
        start: offset,
        end: offset + character.length,
        isAnchor: false,
        isTail: WORD_TAIL_RE.test(character),
      });
      offset += character.length;
    }
  }

  return units;
}

/**
 * Curriculum word spans for one annotated reply, in text order and
 * non-overlapping — the contract `buildPassageBodyParts` expects, with offsets
 * measured against the reply's *plain* text (`plainChatText`).
 *
 * Scans anchors left to right and takes the longest match at each, so 私たち
 * wins over 私 and the scan resumes after whatever it claimed. An index miss is
 * not a failure: most words in a conversation are legitimately not curriculum
 * entries.
 */
export function buildChatWordSpans(
  annotated: string,
  index: ChatWordIndex,
): PassageWordSpan[] {
  if (index.size === 0) {
    return [];
  }

  const plain = plainChatText(annotated);
  const units = buildUnits(annotated);
  const spans: PassageWordSpan[] = [];
  let cursor = 0;

  for (let anchor = 0; anchor < units.length; anchor++) {
    if (!units[anchor].isAnchor || units[anchor].start < cursor) {
      continue;
    }

    // How far a candidate starting here may reach.
    let last = anchor;
    while (
      last + 1 < units.length &&
      units[last + 1].isTail &&
      units[last + 1].end - units[anchor].start <= MAX_CANDIDATE_LENGTH
    ) {
      last++;
    }

    for (let end = last; end >= anchor; end--) {
      const start = units[anchor].start;
      const entry = index.get(plain.slice(start, units[end].end));
      if (!entry) {
        continue;
      }
      spans.push({
        vocabularyItemId: entry.itemId,
        startOffset: start,
        endOffset: units[end].end,
        inflection: entry.inflection,
      });
      cursor = units[end].end;
      break;
    }
  }

  return spans;
}

/**
 * The reply with its bracket notation stripped — the string chat spans are
 * measured against, and the one a screen reader should read.
 */
export function plainChatText(annotated: string): string {
  return parseFurigana(annotated)
    .map((segment) => segment.text)
    .join('');
}
