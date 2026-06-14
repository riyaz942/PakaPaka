import { convertWaniKaniStageToFsrs } from '@/core/import/fsrsConverter';
import type {
  ImportSummary,
  MappedImportItem,
  UnmatchedImportItem,
  WaniKaniAssignment,
  WaniKaniMapResult,
} from '@/core/import/import.types';

function isValidAssignment(value: unknown): value is WaniKaniAssignment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'number' &&
    typeof record.subject_id === 'number' &&
    typeof record.srs_stage === 'number' &&
    typeof record.srs_stage_name === 'string' &&
    (record.burned_at === null || typeof record.burned_at === 'string')
  );
}

export function mapWaniKaniAssignments(
  assignments: unknown[],
  externalIdToItemId: Map<string, string>,
  now: Date = new Date(),
): WaniKaniMapResult {
  const mapped: MappedImportItem[] = [];
  const unmatched: UnmatchedImportItem[] = [];
  let burnedCount = 0;
  let apprenticeCount = 0;

  for (const assignment of assignments) {
    if (!isValidAssignment(assignment)) {
      continue;
    }

    if (assignment.srs_stage <= 0) {
      continue;
    }

    const fsrsState = convertWaniKaniStageToFsrs(assignment.srs_stage, now);
    if (!fsrsState) {
      continue;
    }

    const externalId = String(assignment.subject_id);
    const itemId = externalIdToItemId.get(externalId);

    if (itemId) {
      mapped.push({
        itemId,
        externalId,
        srsStage: assignment.srs_stage,
        srsStageName: assignment.srs_stage_name,
        fsrsState,
      });

      if (fsrsState.isBurned) {
        burnedCount += 1;
      } else if (assignment.srs_stage <= 4) {
        apprenticeCount += 1;
      }
    } else {
      unmatched.push({
        externalId,
        srsStage: assignment.srs_stage,
        srsStageName: assignment.srs_stage_name,
      });
    }
  }

  const summary: ImportSummary = {
    source: 'wanikani',
    mappedCount: mapped.length,
    unmatchedCount: unmatched.length,
    burnedCount,
    apprenticeCount,
  };

  return { mapped, unmatched, summary };
}
