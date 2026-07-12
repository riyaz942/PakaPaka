import { buildMcOptions, pickGrammarDistractors } from './distractors';

const fixedRng = () => 0; // always picks the first remaining candidate

describe('pickGrammarDistractors', () => {
  it('never includes the correct answer', () => {
    const picked = pickGrammarDistractors({
      answer: 'は',
      familyCandidates: ['は', 'が', 'を', 'に'],
      rng: fixedRng,
    });
    expect(picked).not.toContain('は');
    expect(picked).toHaveLength(3);
  });

  it('never includes empty strings or duplicates', () => {
    const picked = pickGrammarDistractors({
      answer: 'は',
      familyCandidates: ['', 'が', 'が', '  ', 'を', 'に'],
      rng: fixedRng,
    });
    expect(picked).toEqual(expect.arrayContaining(['が', 'を', 'に']));
    expect(new Set(picked).size).toBe(picked.length);
  });

  it('prefers family candidates, then fills from the fallback pool', () => {
    const picked = pickGrammarDistractors({
      answer: 'は',
      familyCandidates: ['が', 'を'],
      fallbackPool: ['です', 'から', 'けど'],
      rng: fixedRng,
    });
    expect(picked).toHaveLength(3);
    expect(picked.slice(0, 2)).toEqual(expect.arrayContaining(['が', 'を']));
    expect(['です', 'から', 'けど']).toContain(picked[2]);
  });

  it('does not duplicate family picks from the fallback pool', () => {
    const picked = pickGrammarDistractors({
      answer: 'は',
      familyCandidates: ['が'],
      fallbackPool: ['が', 'を'],
      rng: fixedRng,
    });
    expect(picked).toEqual(['が', 'を']);
  });

  it('returns fewer than count when pools are thin', () => {
    expect(
      pickGrammarDistractors({ answer: 'は', familyCandidates: ['が'], rng: fixedRng }),
    ).toEqual(['が']);
    expect(
      pickGrammarDistractors({ answer: 'は', familyCandidates: [], rng: fixedRng }),
    ).toEqual([]);
  });
});

describe('buildMcOptions', () => {
  it('always contains the correct answer exactly once', () => {
    const options = buildMcOptions('は', ['が', 'を', 'に']);
    expect(options).toHaveLength(4);
    expect(options!.filter((o) => o === 'は')).toHaveLength(1);
  });

  it('returns null with no distractors — caller falls back to type-in', () => {
    expect(buildMcOptions('は', [])).toBeNull();
  });

  it('shuffles deterministically with an injected rng', () => {
    const options = buildMcOptions('は', ['が', 'を', 'に'], () => 0);
    expect([...options!].sort()).toEqual(['が', 'に', 'は', 'を'].sort());
  });
});
