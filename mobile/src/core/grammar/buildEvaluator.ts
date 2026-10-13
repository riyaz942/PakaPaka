import { parseFurigana } from '@/core/furigana/parseFurigana';

export type GrammarBuildResult = 'correct' | 'other_grammar' | 'incorrect';

/** What a Build card grades against (spec §5.2). */
export type GrammarBuildAnswers = {
  /** Furigana notation: the sentence itself, then its `valid` alternates. */
  answers: readonly string[];
  /** Furigana notation: same meaning with a same-family grammar point (D6). */
  otherGrammarAnswers: readonly string[];
  /** The learner's saved answers, already normalised. */
  userAnswers: readonly string[];
};

const IGNORED_RE = /[\s、。！？!?,.　]/g;

/** Katakana → hiragana by code point. ー is left alone (wanakana would turn it into a vowel). */
function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** Katakana folded to hiragana; whitespace and sentence punctuation removed. */
export function normalizeBuildText(text: string): string {
  return toHiragana(text).replace(IGNORED_RE, '');
}

/**
 * Whether `normalizedInput` spells `furigana`, each annotated run written as
 * its kanji or as its reading. Runs match independently, so kanji and kana
 * can mix (寒いからこーとをきます). A different word (僕 for 私) does not match.
 */
export function matchesFuriganaAnswer(normalizedInput: string, furigana: string): boolean {
  const slots = parseFurigana(furigana)
    .map((segment) => {
      const forms = [normalizeBuildText(segment.text)];
      if (segment.reading) forms.push(normalizeBuildText(segment.reading));
      return forms.filter((form) => form.length > 0);
    })
    .filter((forms) => forms.length > 0);

  const failed = new Set<string>();
  const walk = (slot: number, offset: number): boolean => {
    if (slot === slots.length) return offset === normalizedInput.length;
    const memo = `${slot}:${offset}`;
    if (failed.has(memo)) return false;
    for (const form of slots[slot]) {
      if (normalizedInput.startsWith(form, offset) && walk(slot + 1, offset + form.length)) {
        return true;
      }
    }
    failed.add(memo);
    return false;
  };
  return walk(0, 0);
}

/** No typo tolerance: a sentence is right, a same-family swap, or wrong (spec §3.2). */
export function evaluateGrammarBuild(input: string, key: GrammarBuildAnswers): GrammarBuildResult {
  const normalized = normalizeBuildText(input);
  if (!normalized) return 'incorrect';
  if (key.userAnswers.some((answer) => normalizeBuildText(answer) === normalized)) return 'correct';
  if (key.answers.some((answer) => matchesFuriganaAnswer(normalized, answer))) return 'correct';
  if (key.otherGrammarAnswers.some((answer) => matchesFuriganaAnswer(normalized, answer))) {
    return 'other_grammar';
  }
  return 'incorrect';
}
