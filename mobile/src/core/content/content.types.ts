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
