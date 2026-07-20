import React from 'react';
import { View } from 'react-native';

import {
  CrossReferenceSection,
  type CrossReferenceChip,
} from '@/components/learn/CrossReferenceSection';
import type { RelatedItem } from '@/core/content/content.types';
import type {
  CurriculumItemDetail,
  CurriculumParentItem,
  GrammarVocabLink,
} from '@/data/curriculum/itemRepository';

type ItemCrossReferencesProps = {
  item: CurriculumItemDetail;
  /** Graph children from `useRelatedItems`, passed in so callers can also ask
   * whether this section will render anything at all. */
  related: RelatedItem[];
  /** Graph parents from `useItemDependencyStatus` — the component direction. */
  parents?: CurriculumParentItem[];
  grammarVocabLinks?: GrammarVocabLink[];
};

const RELATED_LABEL: Record<string, string> = {
  radical: 'Kanji using this radical',
  kanji: 'Vocabulary using this kanji',
  grammar: 'Vocabulary using this pattern',
};

const COMPONENT_LABEL: Record<string, string> = {
  kanji: 'Built from',
  vocabulary: 'Kanji in this word',
};

function toChips(items: (RelatedItem | CurriculumParentItem)[]): CrossReferenceChip[] {
  return items.map((entry) => ({
    id: entry.id,
    primaryForm: entry.primaryForm,
    meaning: 'meaning' in entry ? entry.meaning : undefined,
  }));
}

/**
 * All four FR72 cross-reference directions for one item, shared by the lesson
 * "Examples & links" section and the details scroll.
 *
 * Component chips (vocabulary → kanji, kanji → radical) are always browsable —
 * they are never collapsed into a bare "Prerequisites met" line. Whether those
 * prerequisites are *met* is the study-status banner's job, not this section's.
 */
export function ItemCrossReferences({
  item,
  related,
  parents = [],
  grammarVocabLinks = [],
}: ItemCrossReferencesProps) {
  const componentLabel = COMPONENT_LABEL[item.itemType];
  const relatedLabel = RELATED_LABEL[item.itemType];

  return (
    <View testID="item-cross-references">
      {componentLabel ? (
        <CrossReferenceSection
          label={componentLabel}
          items={toChips(parents)}
          infoTopic={item.itemType === 'kanji' ? 'radical' : undefined}
          testID="cross-ref-components"
        />
      ) : null}

      {relatedLabel ? (
        <CrossReferenceSection
          label={relatedLabel}
          items={toChips(related)}
          testID="cross-ref-related"
        />
      ) : null}

      {item.itemType === 'vocabulary' ? (
        <CrossReferenceSection
          label="Grammar using this word"
          // `vocabularyPrimaryForm`/`vocabularyMeaning` carry the *grammar*
          // item's form and meaning on this side of the join (pre-existing
          // field naming in `GrammarVocabLink`).
          items={grammarVocabLinks.map((link) => ({
            id: link.grammarItemId,
            primaryForm: link.vocabularyPrimaryForm,
            meaning: link.vocabularyMeaning,
          }))}
          testID="cross-ref-grammar"
        />
      ) : null}
    </View>
  );
}
