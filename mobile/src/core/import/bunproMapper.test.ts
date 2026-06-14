import { mapBunproGrammarItems } from '@/core/import/bunproMapper';

describe('bunproMapper', () => {
  const now = new Date('2026-06-14T12:00:00.000Z');

  it('maps a known grammar point to an internal item with FSRS state', () => {
    const mappings = new Map([['101', '7']]);
    const result = mapBunproGrammarItems(
      [
        {
          grammarPointId: '101',
          srsStage: 3,
          srsStageName: 'apprentice',
        },
      ],
      mappings,
      now,
    );

    expect(result.mapped).toHaveLength(1);
    expect(result.mapped[0]).toMatchObject({
      itemId: '7',
      externalId: '101',
      srsStage: 3,
      fsrsState: {
        isBurned: false,
        srsStageLabel: 'apprentice',
      },
    });
    expect(result.unmatched).toHaveLength(0);
    expect(result.summary.source).toBe('bunpro');
    expect(result.summary.mappedCount).toBe(1);
  });

  it('collects unmatched grammar points instead of dropping them', () => {
    const result = mapBunproGrammarItems(
      [
        {
          grammarPointId: '999',
          srsStage: 5,
          srsStageName: 'guru',
        },
      ],
      new Map(),
      now,
    );

    expect(result.mapped).toHaveLength(0);
    expect(result.unmatched).toEqual([
      {
        externalId: '999',
        srsStage: 5,
        srsStageName: 'guru',
      },
    ]);
    expect(result.summary.unmatchedCount).toBe(1);
  });

  it('maps burned grammar points to burned FSRS states', () => {
    const result = mapBunproGrammarItems(
      [
        {
          grammarPointId: '10',
          srsStage: 9,
          srsStageName: 'burned',
        },
      ],
      new Map([['10', '3']]),
      now,
    );

    expect(result.mapped[0]?.fsrsState.isBurned).toBe(true);
    expect(result.summary.burnedCount).toBe(1);
  });

  it('counts apprentice grammar points separately from burned', () => {
    const result = mapBunproGrammarItems(
      [
        {
          grammarPointId: '11',
          srsStage: 2,
          srsStageName: 'apprentice',
        },
        {
          grammarPointId: '12',
          srsStage: 9,
          srsStageName: 'burned',
        },
      ],
      new Map([
        ['11', '4'],
        ['12', '5'],
      ]),
      now,
    );

    expect(result.summary.apprenticeCount).toBe(1);
    expect(result.summary.burnedCount).toBe(1);
  });

  it('skips malformed payloads and invalid stages', () => {
    const result = mapBunproGrammarItems(
      [
        null,
        { grammarPointId: '', srsStage: 2, srsStageName: 'apprentice' },
        { grammarPointId: '13', srsStage: 0, srsStageName: 'locked' },
      ],
      new Map([['13', '6']]),
      now,
    );

    expect(result.mapped).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
  });

  it('returns empty summary for empty input', () => {
    const result = mapBunproGrammarItems([], new Map(), now);

    expect(result.mapped).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
    expect(result.summary).toEqual({
      source: 'bunpro',
      mappedCount: 0,
      unmatchedCount: 0,
      burnedCount: 0,
      apprenticeCount: 0,
    });
  });
});
