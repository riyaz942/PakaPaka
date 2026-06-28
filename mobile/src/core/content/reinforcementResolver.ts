import type {
  ContentItemType,
  RelatedItem,
  ReinforcementLink,
  ReinforcementSrsSnapshot,
} from '@/core/content/content.types';
import type { SRSStageLabel } from '@/core/srs/srs.types';

export type ReinforcementItemContext = {
  itemId: string;
  itemType: ContentItemType;
};

const STAGE_RANK: Record<SRSStageLabel, number> = {
  apprentice: 1,
  guru: 2,
  master: 3,
  enlightened: 4,
  burned: 5,
};

function isStudied(snapshot: ReinforcementSrsSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  if (snapshot.fsrsState === 'new' && snapshot.reps === 0) return false;
  return true;
}

function formatStageLabel(stage: SRSStageLabel): string {
  return `${stage.charAt(0).toUpperCase()}${stage.slice(1)} stage`;
}

/**
 * Pure recency phrase from SRS snapshot and injected clock.
 * Keeps date math testable via `now`.
 */
export function buildRecencyPhrase(
  snapshot: ReinforcementSrsSnapshot,
  now: Date,
): string {
  const updatedAt = new Date(snapshot.updatedAt);
  const diffMs = now.getTime() - updatedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return 'you learned this today';
  if (diffDays < 2) return 'you learned this yesterday';
  if (diffDays < 7) return 'you reviewed this recently';
  return formatStageLabel(snapshot.srsStageLabel);
}

function formatLinkText(related: RelatedItem, recencyPhrase: string): string {
  if (related.relationshipType === 'reinforces') {
    return `${related.primaryForm} — ${recencyPhrase}`;
  }

  const typeLabel =
    related.itemType === 'radical'
      ? 'radical'
      : related.itemType === 'kanji'
        ? 'kanji'
        : related.itemType;

  return `Uses ${typeLabel} ${related.primaryForm} (${related.meaning}) — ${recencyPhrase}`;
}

function rankLink(
  related: RelatedItem,
  snapshot: ReinforcementSrsSnapshot | null | undefined,
  now: Date,
): number {
  if (!isStudied(snapshot)) return -1;

  const stageRank = STAGE_RANK[snapshot!.srsStageLabel] ?? 0;
  const updatedAt = new Date(snapshot!.updatedAt).getTime();
  // Negative value; closer to zero = more recent = higher rank.
  const recencyBoost = updatedAt - now.getTime();

  // Prefer reinforces edges, then higher stage, then more recent review.
  const typeBoost = related.relationshipType === 'reinforces' ? 1000 : 0;

  return typeBoost + stageRank * 100 + recencyBoost / 1_000_000;
}

/**
 * Finds cross-domain reinforcement links ranked by pedagogical relevance.
 * Unstudied targets (no SRS row or fsrsState=new with reps=0) are excluded.
 */
export function resolveReinforcement(
  _item: ReinforcementItemContext,
  relatedItems: RelatedItem[],
  srsStateMap: Map<string, ReinforcementSrsSnapshot | null>,
  options: { now?: Date } = {},
): ReinforcementLink[] {
  const now = options.now ?? new Date();

  const links: ReinforcementLink[] = [];

  for (const related of relatedItems) {
    const snapshot = srsStateMap.get(related.id) ?? null;
    if (!isStudied(snapshot)) continue;

    const recencyPhrase = buildRecencyPhrase(snapshot!, now);
    const displayText = formatLinkText(related, recencyPhrase);

    links.push({
      relatedItemId: related.id,
      primaryForm: related.primaryForm,
      meaning: related.meaning,
      relationshipType: related.relationshipType,
      srsStageLabel: snapshot!.srsStageLabel,
      recencyPhrase,
      displayText,
    });
  }

  links.sort((a, b) => {
    const relatedA = relatedItems.find((r) => r.id === a.relatedItemId)!;
    const relatedB = relatedItems.find((r) => r.id === b.relatedItemId)!;
    return (
      rankLink(relatedB, srsStateMap.get(relatedB.id), now) -
      rankLink(relatedA, srsStateMap.get(relatedA.id), now)
    );
  });

  return links;
}
