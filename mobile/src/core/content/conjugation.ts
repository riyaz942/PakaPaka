/**
 * Pure conjugator for the 8 basic forms of verbs and い / な adjectives.
 *
 * Input is the word's dictionary form, its furigana string (`知[し]る`) and a
 * fine-grained `conjugation_class` derived by the content pipeline. The
 * changing tail is always kana outside the `[...]` brackets, so the same
 * string edit works on the surface and on the furigana string.
 *
 * A wrong form is never acceptable: whenever the required ending is missing
 * the result is `null` and the caller shows no table.
 */
export const CONJUGATION_CLASSES = [
  'ichidan',
  'godan',
  'godan-iku',
  'godan-ru-irregular',
  'godan-honorific',
  'godan-u-special',
  'kuru',
  'suru',
  'adj-i',
  'adj-ii',
  'adj-na',
] as const;

export type ConjugationClass = (typeof CONJUGATION_CLASSES)[number];

/** Narrows a stored string to a known class; null for anything else. */
export function parseConjugationClass(value: string | null | undefined): ConjugationClass | null {
  return CONJUGATION_CLASSES.find((cls) => cls === value) ?? null;
}

export const CONJUGATION_FORMS = [
  'plain',
  'plainNegative',
  'plainPast',
  'plainPastNegative',
  'polite',
  'politeNegative',
  'politePast',
  'politePastNegative',
] as const;

export type ConjugationForm = (typeof CONJUGATION_FORMS)[number];

export type ConjugatedCell = { surface: string; furigana: string };
export type ConjugationTable = Record<ConjugationForm, ConjugatedCell>;
export type ConjugatableWord = { primaryForm: string; furigana: string | null };

type EightForms = [string, string, string, string, string, string, string, string];

/** last kana → [a-row for ない, i-row for ます, た-form tail] */
const GODAN_TAILS: Record<string, readonly [string, string, string]> = {
  う: ['わ', 'い', 'った'],
  く: ['か', 'き', 'いた'],
  ぐ: ['が', 'ぎ', 'いだ'],
  す: ['さ', 'し', 'した'],
  つ: ['た', 'ち', 'った'],
  ぬ: ['な', 'に', 'んだ'],
  ぶ: ['ば', 'び', 'んだ'],
  む: ['ま', 'み', 'んだ'],
  る: ['ら', 'り', 'った'],
};

/** Verb forms from a prefix and the ない-stem tail, ます-stem tail and た tail. */
function verbForms(text: string, prefix: string, nai: string, masu: string, ta: string): EightForms {
  return [
    text,
    `${prefix}${nai}ない`,
    `${prefix}${ta}`,
    `${prefix}${nai}なかった`,
    `${prefix}${masu}ます`,
    `${prefix}${masu}ません`,
    `${prefix}${masu}ました`,
    `${prefix}${masu}ませんでした`,
  ];
}

/** い-adjective forms from the text kept in front of くない / かった. */
function adjIForms(text: string, stem: string): EightForms {
  return [
    text,
    `${stem}くない`,
    `${stem}かった`,
    `${stem}くなかった`,
    `${text}です`,
    `${stem}くないです`,
    `${stem}かったです`,
    `${stem}くなかったです`,
  ];
}

const KURU_PATTERNS: readonly (readonly [string, string, string])[] = [
  ['来[く]る', '来[こ]', '来[き]'],
  ['来る', '来', '来'],
  ['くる', 'こ', 'き'],
];

function conjugateText(text: string, cls: ConjugationClass): EightForms | null {
  switch (cls) {
    case 'ichidan': {
      if (!text.endsWith('る') || text.length < 2) return null;
      return verbForms(text, text.slice(0, -1), '', '', 'た');
    }
    case 'godan':
    case 'godan-iku':
    case 'godan-honorific':
    case 'godan-u-special': {
      const tails = GODAN_TAILS[text.slice(-1)];
      if (!tails || text.length < 2) return null;
      if (cls === 'godan-iku' && !text.endsWith('く')) return null;
      if (cls === 'godan-u-special' && !text.endsWith('う')) return null;
      if (cls === 'godan-honorific' && !text.endsWith('る')) return null;
      const [nai, iRow, ta] = tails;
      const masu = cls === 'godan-honorific' ? 'い' : iRow;
      let pastTail = ta;
      if (cls === 'godan-iku') pastTail = 'った';
      if (cls === 'godan-u-special') pastTail = 'うた';
      return verbForms(text, text.slice(0, -1), nai, masu, pastTail);
    }
    case 'godan-ru-irregular': {
      if (!text.endsWith('ある')) return null;
      return verbForms(text, text.slice(0, -2), '', 'あり', 'あった');
    }
    case 'kuru': {
      const match = KURU_PATTERNS.find(([ending]) => text.endsWith(ending));
      if (!match) return null;
      const [ending, naiStem, masuStem] = match;
      return verbForms(text, text.slice(0, -ending.length), naiStem, masuStem, `${masuStem}た`);
    }
    case 'suru': {
      if (!text.endsWith('する')) return null;
      return verbForms(text, text.slice(0, -2), 'し', 'し', 'した');
    }
    case 'adj-i': {
      if (!text.endsWith('い') || text.length < 2) return null;
      return adjIForms(text, text.slice(0, -1));
    }
    case 'adj-ii': {
      if (!text.endsWith('いい')) return null;
      return adjIForms(text, `${text.slice(0, -2)}よ`);
    }
    case 'adj-na': {
      if (text.length < 1) return null;
      return [
        `${text}だ`,
        `${text}じゃない`,
        `${text}だった`,
        `${text}じゃなかった`,
        `${text}です`,
        `${text}ではありません`,
        `${text}でした`,
        `${text}ではありませんでした`,
      ];
    }
  }
}

/** The 8 forms of a word, or null when the class does not fit the word's ending. */
export function conjugate(word: ConjugatableWord, cls: ConjugationClass): ConjugationTable | null {
  const surfaces = conjugateText(word.primaryForm, cls);
  const furigana = conjugateText(word.furigana ?? word.primaryForm, cls);
  if (!surfaces || !furigana) return null;
  const table = {} as ConjugationTable;
  CONJUGATION_FORMS.forEach((form, i) => {
    table[form] = { surface: surfaces[i], furigana: furigana[i] };
  });
  return table;
}

export const WORD_GROUP_LABEL: Record<ConjugationClass, string> = {
  ichidan: 'Ichidan verb',
  godan: 'Godan verb',
  'godan-iku': 'Godan verb',
  'godan-ru-irregular': 'Godan verb',
  'godan-honorific': 'Godan verb',
  'godan-u-special': 'Godan verb',
  kuru: 'Irregular verb',
  suru: 'する verb',
  'adj-i': 'い adjective',
  'adj-ii': 'い adjective',
  'adj-na': 'な adjective',
};

export type LookAlike = { tag: string; note: string };

const I_ROW = 'いきぎしじちぢにひびぴみりゐ';
const E_ROW = 'えけげせぜてでねへべぺめれゑ';

/** `知[し]る` → `しる`; plain kana and kanji-only text pass through. */
function readingOf(word: ConjugatableWord): string {
  return (word.furigana ?? word.primaryForm).replace(/.\[([^\]]*)\]/g, '$1');
}

/** Words whose ending suggests the wrong group; null for ordinary words. */
export function lookAlike(word: ConjugatableWord, cls: ConjugationClass): LookAlike | null {
  if (cls === 'godan') {
    const reading = readingOf(word);
    if (!reading.endsWith('る') || reading.length < 2) return null;
    const before = reading.slice(-2, -1);
    const vowel = I_ROW.includes(before) ? 'い' : E_ROW.includes(before) ? 'え' : null;
    if (!vowel) return null;
    return {
      tag: 'Exception: looks ichidan',
      note: `It ends in ${vowel}-sound + る, so it looks ichidan. But ${word.primaryForm} is godan. る → ら for ない.`,
    };
  }
  if (cls === 'adj-na' && word.primaryForm.endsWith('い')) {
    return {
      tag: 'Exception: looks like an い adjective',
      note: `It ends in い, but it is a な adjective. ${word.primaryForm}じゃない, not ${word.primaryForm.slice(0, -1)}くない.`,
    };
  }
  return null;
}
