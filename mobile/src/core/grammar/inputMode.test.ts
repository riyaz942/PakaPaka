import { englishHintsAllowed, resolveGrammarInputMode } from './inputMode';

describe('resolveGrammarInputMode (Plan 08 stage ladder)', () => {
  it('gives apprentice items multiple choice', () => {
    expect(resolveGrammarInputMode('apprentice')).toBe('mc');
  });

  it.each(['guru', 'master', 'enlightened', 'burned'] as const)(
    'gives %s items type-in',
    (stage) => {
      expect(resolveGrammarInputMode(stage)).toBe('type_in');
    },
  );
});

describe('englishHintsAllowed (Enlightened scaffolding gate)', () => {
  it.each(['apprentice', 'guru', 'master'] as const)('allows English before Enlightened (%s)', (stage) => {
    expect(englishHintsAllowed(stage)).toBe(true);
  });

  it.each(['enlightened', 'burned'] as const)('blocks English at %s', (stage) => {
    expect(englishHintsAllowed(stage)).toBe(false);
  });
});
