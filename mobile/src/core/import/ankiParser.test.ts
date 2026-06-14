import {
  parseAnkiCollection,
  selectCollectionDbFileName,
  type AnkiRawCollectionData,
} from '@/core/import/ankiParser';

describe('ankiParser', () => {
  const validCollection: AnkiRawCollectionData = {
    notes: [
      {
        id: 1,
        guid: 'abc123',
        mid: 1,
        flds: '水\x1fみず',
        sfld: '水',
        tags: ' vocab ',
      },
    ],
    cards: [
      {
        id: 10,
        nid: 1,
        did: 1,
        ivl: 7,
        factor: 2500,
        reps: 5,
        lapses: 1,
        queue: 2,
        type: 2,
      },
    ],
    decksJson: JSON.stringify({
      '1': { name: 'Japanese Core' },
    }),
  };

  it('selects the newest collection database filename available', () => {
    expect(
      selectCollectionDbFileName(['media', 'collection.anki2', 'collection.anki21']),
    ).toBe('collection.anki21');
    expect(
      selectCollectionDbFileName(['collection.anki21b', 'collection.anki21', 'collection.anki2']),
    ).toBe('collection.anki21b');
    expect(selectCollectionDbFileName(['media', 'meta'])).toBeNull();
  });

  it('parses valid legacy and modern collection data', () => {
    const result = parseAnkiCollection(validCollection);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.notes).toHaveLength(1);
      expect(result.value.cards).toHaveLength(1);
      expect(result.value.deckName).toBe('Japanese Core');
      expect(result.value.notes[0]?.sfld).toBe('水');
    }
  });

  it('returns an error when notes or cards tables are missing', () => {
    const result = parseAnkiCollection({
      notes: null as unknown as AnkiRawCollectionData['notes'],
      cards: [],
      decksJson: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('anki_invalid_file');
    }
  });

  it('handles empty decks with zero notes and cards', () => {
    const result = parseAnkiCollection({
      notes: [],
      cards: [],
      decksJson: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.notes).toHaveLength(0);
      expect(result.value.cards).toHaveLength(0);
      expect(result.value.deckName).toBe('Imported deck');
    }
  });

  it('filters malformed note and card rows', () => {
    const result = parseAnkiCollection({
      notes: [{ id: 'bad' } as unknown as AnkiRawCollectionData['notes'][number], validCollection.notes[0]!],
      cards: [{ id: 'bad' } as unknown as AnkiRawCollectionData['cards'][number], validCollection.cards[0]!],
      decksJson: '{invalid json',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.notes).toHaveLength(1);
      expect(result.value.cards).toHaveLength(1);
      expect(result.value.deckName).toBe('Imported deck');
    }
  });
});
