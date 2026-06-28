import type { SRSStageLabel, FsrsStateString } from '@/core/srs/srs.types';

export type ContentItemType = 'radical' | 'kanji' | 'vocabulary' | 'grammar';

export type ContentStudyStatus = 'known' | 'in_progress' | 'not_started';

export type ContentParentItem = {
  id: string;
  primaryForm: string;
  itemType: ContentItemType;
};

export type ContentItemSummary = {
  id: string;
  itemType: ContentItemType;
  primaryForm: string;
  meaning: string;
  mnemonicText: string | null;
};

export type RelatedItemRelationshipType = 'requires' | 'builds_on' | 'reinforces';

export type RelatedItem = {
  id: string;
  itemType: ContentItemType;
  primaryForm: string;
  meaning: string;
  relationshipType: RelatedItemRelationshipType;
};

export type ReinforcementSrsSnapshot = {
  srsStageLabel: SRSStageLabel;
  updatedAt: string;
  fsrsState: FsrsStateString;
  reps: number;
};

export type ReinforcementLink = {
  relatedItemId: string;
  primaryForm: string;
  meaning: string;
  relationshipType: RelatedItemRelationshipType;
  srsStageLabel: SRSStageLabel;
  recencyPhrase: string;
  displayText: string;
};
