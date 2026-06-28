import type { ConjugationParseResult, GrammarAnswerContext } from './grammar.types';

const POLITE_ENDINGS = ['です', 'ます', 'ました', 'ません', 'でした', 'ませんでした'];

function trimForms(forms: string[]): string[] {
  return forms.map((f) => f.trim()).filter((f) => f.length > 0);
}

function isPoliteForm(text: string): boolean {
  return POLITE_ENDINGS.some((ending) => text.endsWith(ending));
}

function hasPoliteAcceptedForm(forms: string[]): boolean {
  return forms.some(isPoliteForm);
}

function primaryForm(forms: string[]): string {
  return forms[0] ?? '';
}

/**
 * Bounded conjugation checks for N5 seed patterns.
 * Unsupported rule shapes return { status: 'unsupported' } for Levenshtein fallback.
 */
export function parseConjugation(
  answer: string,
  grammar: GrammarAnswerContext,
): ConjugationParseResult {
  const trimmed = answer.trim();
  const forms = trimForms(grammar.acceptedForms);

  if (!trimmed || forms.length === 0) {
    return { status: 'unsupported' };
  }

  if (forms.some((form) => trimmed === form)) {
    return { status: 'correct' };
  }

  const rules = grammar.conjugationRules;

  if (rules.polite === true && hasPoliteAcceptedForm(forms)) {
    if (!isPoliteForm(trimmed)) {
      const polite = forms.find(isPoliteForm) ?? primaryForm(forms);
      return { status: 'incorrect', displayAnswer: polite };
    }
    return { status: 'unsupported' };
  }

  if (rules.polite === false) {
    const casualForms = forms.filter((form) => !isPoliteForm(form));
    if (casualForms.length > 0 && isPoliteForm(trimmed)) {
      return { status: 'incorrect', displayAnswer: casualForms[0] };
    }
    return { status: 'unsupported' };
  }

  // Particle-only or unknown rule shapes — defer to fallback matcher.
  return { status: 'unsupported' };
}
