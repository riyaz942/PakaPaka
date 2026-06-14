import { mapAnkiCards } from '@/core/import/ankiMapper';
import type { AnkiParseResult } from '@/core/import/import.types';

describe('ankiMapper', () => {
  const now = new Date('2026-06-14T12:00:00.000Z');

  const baseParseResult: AnkiParseResult = {
    deckName: 'Japanese Core',
    notes: [
      {
        id: 1,
        guid: 'note-1',
        mid: 1,
        flds: '水\x1fみず',
        sfld: '水',
        tags: '',
      },
      {
        id: 2,
        guid: 'note-2',
        mid: 1,
        flds: '火\x1fひ',
        sfld: '火',
        tags: '',
      },
    ],
    cards: [
      {
        id: 10,
        nid: 1,
        did: 1,
        ivl: 7,
        factor: 2500,
        reps: 4,
        lapses: 0,
        queue: 2,
        type: 2,
      },
      {
        id: 11,
        nid: 2,
        did: 1,
        ivl: -600,
        factor: 2500,
        reps: 1,
        lapses: 0,
        queue: 1,
        type: 1,
      },
      {
        id: 12,
        nid: 2,
        did: 1,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        queue: 0,
        type: 0,
      },
    ],
  };

  it('maps a known note sort field to an internal item with FSRS state', () => {
    const mappings = new Map([['水', '7']]);
    const result = mapAnkiCards(baseParseResult, mappings, now);

    expect(result.mapped).toHaveLength(1);
    expect(result.mapped[0]).toMatchObject({
      itemId: '7',
      externalId: '水',
      fsrsState: {
        state: 'review',
        isBurned: false,
      },
    });
    expect(result.summary.source).toBe('anki');
    expect(result.summary.mappedCount).toBe(1);
  });

  it('collects unmatched notes instead of dropping them', () => {
    const result = mapAnkiCards(baseParseResult, new Map(), now);

    expect(result.mapped).toHaveLength(0);
    expect(result.unmatched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalId: '水' }),
        expect.objectContaining({ externalId: '火' }),
      ]),
    );
    expect(result.summary.unmatchedCount).toBe(2);
  });

  it('converts learning and review cards with summary breakdown', () => {
    const mappings = new Map([
      ['水', '1'],
      ['火', '2'],
    ]);
    const result = mapAnkiCards(baseParseResult, mappings, now);

    expect(result.mapped).toHaveLength(2);
    expect(result.mapped.find((item) => item.externalId === '水')?.fsrsState.state).toBe('review');
    expect(result.mapped.find((item) => item.externalId === '火')?.fsrsState.state).toBe('learning');
    expect(result.summary.apprenticeCount).toBeGreaterThan(0);
  });

  it('imports suspended cards with their current interval state', () => {
    const parseResult: AnkiParseResult = {
      deckName: 'Deck',
      notes: [
        {
          id: 3,
          guid: 'note-3',
          mid: 1,
          flds: '木',
          sfld: '木',
          tags: '',
        },
      ],
      cards: [
        {
          id: 20,
          nid: 3,
          did: 1,
          ivl: 14,
          factor: 2500,
          reps: 8,
          lapses: 1,
          queue: -1,
          type: 2,
        },
      ],
    };

    const result = mapAnkiCards(parseResult, new Map([['木', '3']]), now);

    expect(result.mapped[0]?.fsrsState.state).toBe('review');
    expect(result.mapped[0]?.fsrsState.reps).toBe(8);
  });

  it('returns empty results for empty input', () => {
    const result = mapAnkiCards(
      { deckName: 'Empty', notes: [], cards: [] },
      new Map(),
      now,
    );

    expect(result.mapped).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
    expect(result.summary.mappedCount).toBe(0);
    expect(result.summary.unmatchedCount).toBe(0);
    expect(result.summary.warningMessage).toBe('No cards found in this deck.');
  });
});
