import type { BuildDiagnosis, MistakeKind } from './mistake.types';

type Area = 'particles' | 'conjugation' | 'spelling';

/** Small slips that get a "close" nudge. Kinds not here (wrong/missing/extra word, order, grammar) are a real miss. */
const AREA: Partial<Record<MistakeKind, Area>> = {
  particle_missing: 'particles',
  particle_wrong: 'particles',
  particle_extra: 'particles',
  form: 'conjugation',
  te_ta: 'conjugation',
  verb_group: 'conjugation',
  adjective_type: 'conjugation',
  transitivity: 'conjugation',
  homophone_kanji: 'spelling',
  spelling_sokuon: 'spelling',
  spelling_long_vowel: 'spelling',
};

const AREA_ORDER: Area[] = ['particles', 'conjugation', 'spelling'];
const MAX_CLOSE_MISTAKES = 2;

/** One-line nudge when a wrong Build answer has 1–2 small slips only; null when it is a real miss. */
export function closeNudge(diagnosis: BuildDiagnosis | null): string | null {
  if (!diagnosis || diagnosis.lines.length > 0) return null;
  const { marks } = diagnosis;
  if (marks.length === 0 || marks.length > MAX_CLOSE_MISTAKES) return null;
  const areas = marks.map((mark) => AREA[mark.kind]);
  if (areas.some((area) => area === undefined)) return null;
  const named = AREA_ORDER.filter((area) => areas.includes(area));
  return `~ Close! Check your ${named.join(' and ')}.`;
}
