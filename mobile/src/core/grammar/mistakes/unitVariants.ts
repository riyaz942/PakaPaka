import {
  CONJUGATION_FORMS,
  conjugate,
  type ConjugationClass,
  type ConjugationForm,
} from '@/core/content/conjugation';
import { normalizeBuildText } from '@/core/grammar/buildEvaluator';
import { parseFurigana } from '@/core/furigana/parseFurigana';

import type {
  AnswerUnit,
  DiagnosisWord,
  DiagnosisWordForm,
  FormDims,
  UnitForm,
  UnitVariant,
  VariantKind,
} from './mistake.types';

export const PARTICLES: readonly string[] =
  'は が を に で へ と も の から まで より や か ね よ'.split(' ');

const ADJECTIVE_CLASSES: readonly ConjugationClass[] = ['adj-i', 'adj-ii', 'adj-na'];
const WRONG_TE_TAILS = ['って', 'いて', 'いで', 'して', 'んで'];

/** Furigana notation resolved to its kana reading. */
function readingOf(furigana: string): string {
  return parseFurigana(furigana)
    .map((segment) => segment.reading ?? segment.text)
    .join('');
}

/** た → て, だ → で on the last character. */
function toTe(text: string): string {
  return text.endsWith('た')
    ? `${text.slice(0, -1)}て`
    : text.endsWith('だ')
      ? `${text.slice(0, -1)}で`
      : text;
}

/** Normalized surface and reading spellings of one form of a word; null when the class does not fit. */
function formSpellings(
  word: Pick<DiagnosisWordForm, 'primaryForm' | 'furigana'>,
  cls: ConjugationClass,
  form: UnitForm,
): string[] | null {
  const cell = conjugate(word, cls)?.[form === 'te' ? 'plainPast' : form];
  if (!cell) return null;
  const spellings = [cell.surface, readingOf(cell.furigana)];
  return spellings.map((text) => normalizeBuildText(form === 'te' ? toTe(text) : text));
}

export function unitForm(
  unit: AnswerUnit,
  word: DiagnosisWord | null,
): { form: UnitForm; base: DiagnosisWordForm } | null {
  if (unit.role === 'particle') return null;
  const mine = [unit.surface, unit.reading].map(normalizeBuildText);
  if (word?.conjugationClass) {
    const base = {
      primaryForm: word.primaryForm,
      furigana: word.furigana,
      conjugationClass: word.conjugationClass,
    };
    for (const form of [...CONJUGATION_FORMS, 'te' as const]) {
      const spellings = formSpellings(base, word.conjugationClass, form);
      if (spellings?.some((text) => mine.includes(text))) return { form, base };
    }
  }
  // 食べたい is a bare い-adjective on a verb word; a classless word (違い) or an adjective is not.
  const fallbackFits = word
    ? word.conjugationClass && !ADJECTIVE_CLASSES.includes(word.conjugationClass)
    : true;
  if (fallbackFits && unit.surface.endsWith('い')) {
    return {
      form: 'plain',
      base: { primaryForm: unit.surface, furigana: null, conjugationClass: 'adj-i' },
    };
  }
  return null;
}

function formDims(form: ConjugationForm): Required<FormDims> {
  return {
    register: form.startsWith('polite') ? 'polite' : 'plain',
    tense: form.includes('Past') ? 'past' : 'non-past',
    polarity: form.includes('Negative') ? 'negative' : 'positive',
  };
}

/** Only the dimensions where `variant` differs from `from`. */
function differingDims(from: ConjugationForm, variant: ConjugationForm): FormDims {
  const a = formDims(from);
  const b = formDims(variant);
  const dims: Record<string, string> = {};
  for (const key of Object.keys(a) as (keyof FormDims)[]) {
    if (a[key] !== b[key]) dims[key] = b[key];
  }
  return dims as FormDims;
}

const VOWEL_ROWS: Record<string, string> = {
  a: 'あかがさざただなはばぱまやらわぁゃ',
  i: 'いきぎしじちぢにひびぴみりぃ',
  u: 'うくぐすずつづぬふぶぷむゆるゔぅゅ',
  e: 'えけげせぜてでねへべぺめれぇ',
  o: 'おこごそぞとどのほぼぽもよろをぉょ',
};

function vowelOf(kana: string): string | null {
  return Object.keys(VOWEL_ROWS).find((vowel) => VOWEL_ROWS[vowel].includes(kana)) ?? null;
}

/** Readings with one long-vowel kana removed (ー; おう, えい; a vowel repeating the one before). */
function longVowelDrops(reading: string): string[] {
  const drops: string[] = [];
  for (let i = 1; i < reading.length; i++) {
    const ch = reading[i];
    const prev = vowelOf(reading[i - 1]);
    const isLong =
      ch === 'ー' ||
      (ch === 'う' && prev === 'o') ||
      (ch === 'い' && prev === 'e') ||
      ('あいうえお'.includes(ch) && prev !== null && vowelOf(ch) === prev);
    if (isLong) drops.push(reading.slice(0, i) + reading.slice(i + 1));
  }
  return drops;
}

export function unitVariants(unit: AnswerUnit, word: DiagnosisWord | null): UnitVariant[] {
  const own = new Set([unit.surface, unit.reading].map(normalizeBuildText));
  const variants: UnitVariant[] = [];
  const seen = new Set<string>();
  const add = (texts: string[] | null, kind: VariantKind, extra: Partial<UnitVariant> = {}) => {
    for (const raw of texts ?? []) {
      const text = normalizeBuildText(raw);
      if (!text || own.has(text) || seen.has(`${kind}:${text}`)) continue;
      seen.add(`${kind}:${text}`);
      variants.push({ text, kind, ...extra });
    }
  };

  if (unit.role === 'particle') {
    add(
      PARTICLES.filter((p) => !own.has(p)),
      'particle_wrong',
    );
    return variants;
  }

  const found = unitForm(unit, word);
  if (found) {
    const { form, base } = found;
    const cls = base.conjugationClass as ConjugationClass;
    // The word's own base; the い-adjective fallback has no reading, so conjugate the unit's too.
    const fromWord =
      !!word && base.primaryForm === word.primaryForm && cls === word.conjugationClass;
    const bases =
      fromWord || base.primaryForm === unit.reading
        ? [base]
        : [base, { ...base, primaryForm: unit.reading }];

    if (form !== 'te') {
      for (const other of CONJUGATION_FORMS) {
        if (other === form) continue;
        for (const b of bases)
          add(formSpellings(b, cls, other), 'form', { dims: differingDims(form, other) });
      }
    }
    if (fromWord && word) {
      if (cls === 'godan' || cls === 'ichidan') {
        add(formSpellings(base, cls === 'godan' ? 'ichidan' : 'godan', form), 'verb_group');
      }
      if (cls === 'adj-i') {
        add(formSpellings(base, 'adj-na', form), 'adjective_type');
      }
      if (cls === 'adj-na') {
        // Learner treats the な-adjective like an い-adjective: きれい + くない.
        const asI = {
          primaryForm: `${base.primaryForm}い`,
          furigana: base.furigana && `${base.furigana}い`,
        };
        add(formSpellings(asI, 'adj-i', form), 'adjective_type');
      }
      if (cls === 'godan' && (form === 'te' || form === 'plainPast')) {
        const stems = [word.primaryForm, readingOf(word.furigana ?? word.primaryForm)].map((t) =>
          t.slice(0, -1),
        );
        const tails = WRONG_TE_TAILS.map((tail) =>
          form === 'te' ? tail : tail.replace(/て$/, 'た').replace(/で$/, 'だ'),
        );
        add(
          stems.flatMap((stem) => tails.map((tail) => stem + tail)),
          'te_ta',
          { dictForm: word.primaryForm },
        );
      }
      if (word.partner?.conjugationClass) {
        add(formSpellings(word.partner, word.partner.conjugationClass, form), 'transitivity');
      }
      for (const homophone of word.homophones) {
        if (homophone.conjugationClass) {
          add(formSpellings(homophone, homophone.conjugationClass, form), 'homophone_kanji');
        }
      }
    }
  } else if (word && !word.conjugationClass) {
    for (const homophone of word.homophones) {
      add(
        [homophone.primaryForm, readingOf(homophone.furigana ?? homophone.primaryForm)],
        'homophone_kanji',
      );
    }
  }

  const reading = normalizeBuildText(unit.reading);
  add(
    [...reading].flatMap((ch, i) =>
      ch === 'っ' ? [reading.slice(0, i) + reading.slice(i + 1)] : [],
    ),
    'spelling_sokuon',
  );
  add(longVowelDrops(reading), 'spelling_long_vowel');
  return variants;
}
