import { pickGrammarSentences } from './sentencePicker';

const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((japanese) => ({ japanese }));

describe('pickGrammarSentences', () => {
  it('returns two different sentences', () => {
    for (let i = 0; i < 20; i += 1) {
      const { read, build } = pickGrammarSentences(pool, []);
      expect(read.japanese).not.toBe(build.japanese);
    }
  });

  it('never picks a sentence from the last review', () => {
    expect(pickGrammarSentences(pool, ['a', 'b'], () => 0)).toEqual({
      read: { japanese: 'c' },
      build: { japanese: 'd' },
    });
    expect(pickGrammarSentences(pool, ['a', 'b'], () => 0.999)).toEqual({
      read: { japanese: 'h' },
      build: { japanese: 'g' },
    });
  });

  it('fails loudly when fewer than two sentences remain', () => {
    expect(() => pickGrammarSentences(pool.slice(0, 3), ['a', 'b'])).toThrow(/at least 2/);
  });
});
