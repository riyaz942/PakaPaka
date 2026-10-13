import { buildPassageBodyParts } from './passageBodyParts';

describe('buildPassageBodyParts with a grammar span', () => {
  it('cuts the grammar out of a word span that contains it', () => {
    // もう食べた。 — 食べた is one word span (ta); た is the grammar.
    const parts = buildPassageBodyParts(
      'もう食べた。',
      'もう食[た]べた。',
      [
        { vocabularyItemId: '1', startOffset: 0, endOffset: 2, inflection: null },
        { vocabularyItemId: '2', startOffset: 2, endOffset: 5, inflection: 'ta' },
      ],
      { start: 4, end: 5 },
    );

    expect(parts.map((p) => [p.surface, p.vocabularyItemId, !!p.isGrammar, !!p.overlapsGrammar])).toEqual([
      ['もう', '1', false, false],
      ['食べ', '2', false, true],
      ['た', null, true, false],
      ['。', null, false, false],
    ]);
  });

  it('marks a free-standing grammar span', () => {
    const parts = buildPassageBodyParts('今日は暑い。', null, [], { start: 2, end: 3 });
    expect(parts.filter((p) => p.isGrammar).map((p) => p.surface)).toEqual(['は']);
  });
});
