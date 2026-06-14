import { convertAnkiCardToFsrs } from '@/core/import/fsrsConverter';
import type {
  AnkiCard,
  AnkiMapResult,
  AnkiParseResult,
  ImportSummary,
  MappedImportItem,
  UnmatchedImportItem,
} from '@/core/import/import.types';

const CARD_TYPE_PRIORITY: Record<number, number> = {
  2: 4,
  3: 3,
  1: 2,
  0: 1,
};

function getAnkiStageLabel(card: AnkiCard): string {
  if (card.type === 0) {
    return 'new';
  }
  if (card.type === 3) {
    return 'relearning';
  }
  if (card.type === 1 || card.queue === 1 || card.queue === 3) {
    return 'learning';
  }
  if (card.ivl >= 365) {
    return 'burned';
  }
  if (card.ivl >= 30) {
    return 'master';
  }
  if (card.ivl >= 7) {
    return 'guru';
  }
  return 'apprentice';
}

function getAnkiSrsStage(card: AnkiCard): number {
  if (card.type === 0) {
    return 0;
  }
  if (card.type === 1 || card.queue === 1 || card.queue === 3) {
    return 1;
  }
  if (card.ivl >= 365) {
    return 9;
  }
  if (card.ivl >= 30) {
    return 7;
  }
  if (card.ivl >= 7) {
    return 5;
  }
  if (card.ivl >= 1) {
    return 3;
  }
  return 2;
}

function selectPrimaryCard(cards: AnkiCard[]): AnkiCard | null {
  if (cards.length === 0) {
    return null;
  }

  return cards.reduce((best, card) => {
    const bestPriority = CARD_TYPE_PRIORITY[best.type] ?? 0;
    const cardPriority = CARD_TYPE_PRIORITY[card.type] ?? 0;
    if (cardPriority !== bestPriority) {
      return cardPriority > bestPriority ? card : best;
    }
    return Math.abs(card.ivl) > Math.abs(best.ivl) ? card : best;
  });
}

export function mapAnkiCards(
  parseResult: AnkiParseResult,
  externalIdToItemId: Map<string, string>,
  now: Date = new Date(),
): AnkiMapResult {
  const mapped: MappedImportItem[] = [];
  const unmatched: UnmatchedImportItem[] = [];
  let burnedCount = 0;
  let apprenticeCount = 0;

  const cardsByNoteId = new Map<number, AnkiCard[]>();
  for (const card of parseResult.cards) {
    const existing = cardsByNoteId.get(card.nid) ?? [];
    existing.push(card);
    cardsByNoteId.set(card.nid, existing);
  }

  for (const note of parseResult.notes) {
    const noteCards = cardsByNoteId.get(note.id) ?? [];
    const primaryCard = selectPrimaryCard(noteCards);
    if (!primaryCard) {
      continue;
    }

    const fsrsState = convertAnkiCardToFsrs(primaryCard, now);
    if (!fsrsState) {
      continue;
    }

    const externalId = note.sfld;
    const itemId = externalIdToItemId.get(externalId);
    const srsStage = getAnkiSrsStage(primaryCard);
    const srsStageName = getAnkiStageLabel(primaryCard);

    if (itemId) {
      mapped.push({
        itemId,
        externalId,
        srsStage,
        srsStageName,
        fsrsState,
      });

      if (fsrsState.isBurned) {
        burnedCount += 1;
      } else if (srsStage <= 4) {
        apprenticeCount += 1;
      }
    } else {
      unmatched.push({
        externalId,
        srsStage,
        srsStageName,
      });
    }
  }

  const summary: ImportSummary = {
    source: 'anki',
    mappedCount: mapped.length,
    unmatchedCount: unmatched.length,
    burnedCount,
    apprenticeCount,
    ...(parseResult.notes.length === 0
      ? { warningMessage: 'No cards found in this deck.' }
      : {}),
  };

  return { mapped, unmatched, summary };
}
