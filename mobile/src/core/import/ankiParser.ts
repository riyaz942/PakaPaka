import type { AnkiCard, AnkiNote, AnkiParseResult } from '@/core/import/import.types';
import type { AppError, Result } from '@/types/result.types';

export type AnkiRawNoteRow = {
  id: number;
  guid: string;
  mid: number;
  flds: string;
  sfld: string;
  tags: string;
};

export type AnkiRawCardRow = {
  id: number;
  nid: number;
  did: number;
  ivl: number;
  factor: number;
  reps: number;
  lapses: number;
  queue: number;
  type: number;
};

export type AnkiRawCollectionData = {
  notes: AnkiRawNoteRow[];
  cards: AnkiRawCardRow[];
  decksJson: string | null;
};

const COLLECTION_DB_NAMES = ['collection.anki21b', 'collection.anki21', 'collection.anki2'] as const;

export function listCollectionDbFileNames(fileNames: string[]): string[] {
  return COLLECTION_DB_NAMES.filter((candidate) => fileNames.includes(candidate));
}

export function selectCollectionDbFileName(fileNames: string[]): string | null {
  return listCollectionDbFileNames(fileNames)[0] ?? null;
}

function parseDeckName(decksJson: string | null, defaultDeckId?: number): string {
  if (!decksJson) {
    return 'Imported deck';
  }

  try {
    const decks = JSON.parse(decksJson) as Record<string, { name?: string }>;
    const deckEntries = Object.entries(decks);

    if (defaultDeckId !== undefined) {
      const match = decks[String(defaultDeckId)];
      if (match?.name) {
        return match.name;
      }
    }

    const firstNamedDeck = deckEntries.find(([, deck]) => typeof deck.name === 'string' && deck.name.length > 0);
    return firstNamedDeck?.[1]?.name ?? 'Imported deck';
  } catch {
    return 'Imported deck';
  }
}

function isValidNoteRow(value: unknown): value is AnkiRawNoteRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'number' &&
    typeof row.guid === 'string' &&
    typeof row.mid === 'number' &&
    typeof row.flds === 'string' &&
    typeof row.sfld === 'string' &&
    typeof row.tags === 'string'
  );
}

function isValidCardRow(value: unknown): value is AnkiRawCardRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'number' &&
    typeof row.nid === 'number' &&
    typeof row.did === 'number' &&
    typeof row.ivl === 'number' &&
    typeof row.factor === 'number' &&
    typeof row.reps === 'number' &&
    typeof row.lapses === 'number' &&
    typeof row.queue === 'number' &&
    typeof row.type === 'number'
  );
}

export function parseAnkiCollection(
  data: AnkiRawCollectionData,
): Result<AnkiParseResult, AppError> {
  if (!Array.isArray(data.notes) || !Array.isArray(data.cards)) {
    return {
      ok: false,
      error: {
        code: 'anki_invalid_file',
        message: 'Anki collection is missing notes or cards tables',
        userMessage:
          "This file doesn't appear to be a valid Anki deck. Make sure you're selecting an .apkg file exported from Anki.",
      },
    };
  }

  const notes: AnkiNote[] = data.notes.filter(isValidNoteRow).map((row) => ({
    id: row.id,
    guid: row.guid,
    mid: row.mid,
    flds: row.flds,
    sfld: row.sfld,
    tags: row.tags,
  }));

  const cards: AnkiCard[] = data.cards.filter(isValidCardRow).map((row) => ({
    id: row.id,
    nid: row.nid,
    did: row.did,
    ivl: row.ivl,
    factor: row.factor,
    reps: row.reps,
    lapses: row.lapses,
    queue: row.queue,
    type: row.type,
  }));

  const defaultDeckId = cards[0]?.did;
  const deckName = parseDeckName(data.decksJson, defaultDeckId);

  return {
    ok: true,
    value: { notes, cards, deckName },
  };
}
