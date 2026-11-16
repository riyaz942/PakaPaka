import type { ConjugationClass } from '@/core/content/conjugation';

import type { FormDims, Mistake } from './mistake.types';

const REGISTER_WORD = { polite: 'polite', plain: 'plain' } as const;
const TENSE_WORD = { past: 'past', 'non-past': 'non-past' } as const;
const POLARITY_WORD = { negative: 'negative', positive: 'positive' } as const;

function verbGroupWord(cls: ConjugationClass): string | null {
  if (cls === 'ichidan') return 'る-verb';
  return cls.startsWith('godan') ? 'う-verb' : null;
}

function adjectiveWord(cls: ConjugationClass): string | null {
  if (cls === 'adj-na') return 'な-adjective';
  return cls === 'adj-i' || cls === 'adj-ii' ? 'い-adjective' : null;
}

/** Kinds whose line does not quote the expected text. */
const NO_EXPECTED_KINDS: Mistake['kind'][] = [
  'particle_extra',
  'grammar_not_used',
  'word_extra',
  'word_order',
];

function formLine(dims: FormDims, expected: string): string | null {
  const { register, tense, polarity } = dims;
  const count = [register, tense, polarity].filter(Boolean).length;
  if (count === 0) return null;
  if (count > 1) {
    const words = [
      register && REGISTER_WORD[register],
      tense && TENSE_WORD[tense],
      polarity && POLARITY_WORD[polarity],
    ].filter(Boolean);
    return `This card asks for ${words.join(' ')}: ${expected}.`;
  }
  if (register) return `This card asks for ${REGISTER_WORD[register]} form: ${expected}.`;
  if (tense) return `The English is ${tense === 'past' ? 'past' : 'not past'}: ${expected}.`;
  return `The English is ${polarity === 'negative' ? 'negative' : 'positive'}: ${expected}.`;
}

/** Where a particle mistake sits: "After 学校", "Before 学校", or nothing when both neighbours are unknown. */
function particlePlace(before: string | null, after: string | null): string | null {
  if (before !== null) return `After ${before}`;
  return after !== null ? `Before ${after}` : null;
}

/** One English line for a Build mistake. Falls back to the wrong_word line when a field the kind needs is missing. */
export function explainMistake(mistake: Mistake, grammarLabel: string): string {
  const { kind, typed, before, after, dims, dictForm, conjugationClass, transitivity } = mistake;
  const expected = mistake.expected[0] ?? '';
  const alts = mistake.expected.join(' or ');
  const wrote = `You wrote ${typed}.`;
  const place = particlePlace(before, after);

  if (!expected && !NO_EXPECTED_KINDS.includes(kind)) {
    return typed ? wrote : 'Your answer has a mistake here.';
  }

  switch (kind) {
    case 'particle_missing': {
      let lead = `You need ${alts}.`;
      if (before !== null && after !== null)
        lead = `Between ${before} and ${after}, you need ${alts}.`;
      else if (place) lead = `${place}, you need ${alts}.`;
      return `${lead} Your answer has no particle there.`;
    }
    case 'particle_wrong':
      return `${place ? `${place}, you` : 'You'} used ${typed}. This sentence needs ${alts}.`;
    case 'particle_extra':
      return `${place ? `${place}, you` : 'You'} added ${typed}. This sentence has no particle there.`;
    case 'form': {
      const line = dims && formLine(dims, expected);
      if (line) return `${wrote} ${line}`;
      break;
    }
    case 'verb_group': {
      const group = conjugationClass && verbGroupWord(conjugationClass);
      if (dictForm && group) return `${wrote} ${dictForm} is a ${group}: ${expected}.`;
      break;
    }
    case 'te_ta': {
      if (!dictForm) break;
      if (conjugationClass === 'godan-iku') return `${wrote} ${dictForm} is special: ${expected}.`;
      // The tail only reads true when the answer is spelled like dictForm (kanji stem); a kana answer falls back.
      const stem = dictForm.slice(0, -1);
      if (!stem || !expected.startsWith(stem)) break;
      return `${wrote} ${dictForm.slice(-1)} verbs change to ${expected.slice(stem.length)}: ${expected}.`;
    }
    case 'adjective_type': {
      const type = conjugationClass && adjectiveWord(conjugationClass);
      if (dictForm && type) return `${wrote} ${dictForm} is a ${type}: ${expected}.`;
      break;
    }
    case 'transitivity':
      if (transitivity) return `${wrote} This sentence needs the ${transitivity} verb ${expected}.`;
      break;
    case 'grammar_not_used':
      return `This card tests ${grammarLabel}.`;
    case 'word_missing':
      return `You did not write ${expected}.`;
    case 'word_extra':
      return `You added ${typed}. This sentence does not have it.`;
    case 'word_order':
      return 'All words are correct. The order is not.';
    case 'spelling_sokuon':
      return `Small っ is missing: ${expected}.`;
    case 'spelling_long_vowel':
      return `Long vowel is missing: ${expected}.`;
    case 'homophone_kanji':
      return `Same sound, different kanji: ${expected}.`;
    case 'spelling_typo':
      return `${wrote} Check the spelling: ${expected}.`;
  }
  return `${wrote} This sentence needs ${expected}.`;
}
