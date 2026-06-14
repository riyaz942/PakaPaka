import { convertBunproStageToFsrs } from '@/core/import/fsrsConverter';
import type {
  BunproGrammarItem,
  BunproMapResult,
  ImportSummary,
  MappedImportItem,
  UnmatchedImportItem,
} from '@/core/import/import.types';

function isValidGrammarItem(value: unknown): value is BunproGrammarItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.grammarPointId === 'string' &&
    record.grammarPointId.length > 0 &&
    typeof record.srsStage === 'number' &&
    typeof record.srsStageName === 'string'
  );
}

export function mapBunproGrammarItems(
  items: unknown[],
  externalIdToItemId: Map<string, string>,
  now: Date = new Date(),
): BunproMapResult {
  const mapped: MappedImportItem[] = [];
  const unmatched: UnmatchedImportItem[] = [];
  let burnedCount = 0;
  let apprenticeCount = 0;

  for (const item of items) {
    if (!isValidGrammarItem(item)) {
      continue;
    }

    if (item.srsStage <= 0) {
      continue;
    }

    const fsrsState = convertBunproStageToFsrs(item.srsStage, now);
    if (!fsrsState) {
      continue;
    }

    const externalId = item.grammarPointId;
    const itemId = externalIdToItemId.get(externalId);

    if (itemId) {
      mapped.push({
        itemId,
        externalId,
        srsStage: item.srsStage,
        srsStageName: item.srsStageName,
        fsrsState,
      });

      if (fsrsState.isBurned) {
        burnedCount += 1;
      } else if (item.srsStage <= 4) {
        apprenticeCount += 1;
      }
    } else {
      unmatched.push({
        externalId,
        srsStage: item.srsStage,
        srsStageName: item.srsStageName,
      });
    }
  }

  const summary: ImportSummary = {
    source: 'bunpro',
    mappedCount: mapped.length,
    unmatchedCount: unmatched.length,
    burnedCount,
    apprenticeCount,
  };

  return { mapped, unmatched, summary };
}
