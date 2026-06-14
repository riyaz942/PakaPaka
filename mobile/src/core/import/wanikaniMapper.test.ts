import { mapWaniKaniAssignments } from '@/core/import/wanikaniMapper';

describe('wanikaniMapper', () => {
  const now = new Date('2026-06-14T12:00:00.000Z');

  it('maps a known subject to an internal item with FSRS state', () => {
    const mappings = new Map([['42', '7']]);
    const result = mapWaniKaniAssignments(
      [
        {
          id: 1,
          subject_id: 42,
          srs_stage: 3,
          srs_stage_name: 'apprentice',
          burned_at: null,
        },
      ],
      mappings,
      now,
    );

    expect(result.mapped).toHaveLength(1);
    expect(result.mapped[0]).toMatchObject({
      itemId: '7',
      externalId: '42',
      srsStage: 3,
      fsrsState: {
        isBurned: false,
        srsStageLabel: 'apprentice',
      },
    });
    expect(result.unmatched).toHaveLength(0);
    expect(result.summary.mappedCount).toBe(1);
  });

  it('collects unmatched subjects instead of dropping them', () => {
    const result = mapWaniKaniAssignments(
      [
        {
          id: 2,
          subject_id: 999,
          srs_stage: 5,
          srs_stage_name: 'guru',
          burned_at: null,
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

  it('maps burned assignments to burned FSRS states', () => {
    const result = mapWaniKaniAssignments(
      [
        {
          id: 3,
          subject_id: 10,
          srs_stage: 9,
          srs_stage_name: 'burned',
          burned_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      new Map([['10', '3']]),
      now,
    );

    expect(result.mapped[0]?.fsrsState.isBurned).toBe(true);
    expect(result.summary.burnedCount).toBe(1);
  });

  it('counts apprentice assignments separately from burned', () => {
    const result = mapWaniKaniAssignments(
      [
        {
          id: 4,
          subject_id: 11,
          srs_stage: 2,
          srs_stage_name: 'apprentice',
          burned_at: null,
        },
        {
          id: 5,
          subject_id: 12,
          srs_stage: 9,
          srs_stage_name: 'burned',
          burned_at: '2026-01-01T00:00:00.000Z',
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

  it('skips malformed payloads and locked stages', () => {
    const result = mapWaniKaniAssignments(
      [
        null,
        { id: 'bad', subject_id: 1, srs_stage: 1, srs_stage_name: 'apprentice', burned_at: null },
        {
          id: 6,
          subject_id: 13,
          srs_stage: 0,
          srs_stage_name: 'locked',
          burned_at: null,
        },
      ],
      new Map([['13', '6']]),
      now,
    );

    expect(result.mapped).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
  });
});
