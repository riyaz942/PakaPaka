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
  RelatedGrammarItem,
} from '@/data/curriculum/itemRepository';

type ItemCrossReferencesProps = {
  item: CurriculumItemDetail;
  /** Graph children from `useRelatedItems`, passed in so callers can also ask
   * whether this section will render anything at all. */
  related: RelatedItem[];
  /** Graph parents from `useComponentParents` — the component direction. */
  parents?: CurriculumParentItem[];
  grammarVocabLinks?: GrammarVocabLink[];
  relatedGrammar?: RelatedGrammarItem[];
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

function toChips(
  items: (RelatedItem | CurriculumParentItem)[],
): CrossReferenceChip[] {
  return items.map((entry) => ({
    id: entry.id,
    itemType: entry.itemType,
    primaryForm: entry.primaryForm,
    // Radicals with no glyph fall back to their name as the form; repeating it
    // underneath would read as a stutter.
    meaning: entry.meaning === entry.primaryForm ? undefined : entry.meaning,
  }));
}

/**
 * All FR72 cross-reference directions for one item, shared by the lesson
 * "Examples & links" section and the details scroll — plus related-grammar
 * sibling links when present (details parity).
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
  relatedGrammar = [],
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
          // The parts an item is built from get the layer-below hue as a fill;
          // what it leads on to stays on plain surface tiles.
          tileVariant="soft"
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
            itemType: 'grammar' as const,
            primaryForm: link.vocabularyPrimaryForm,
            meaning: link.vocabularyMeaning,
          }))}
          cardType="grammar"
          testID="cross-ref-grammar"
        />
      ) : null}

      {item.itemType === 'grammar' ? (
        <CrossReferenceSection
          label="Related grammar"
          items={relatedGrammar.map((entry) => ({
            id: entry.id,
            itemType: 'grammar' as const,
            primaryForm: entry.primaryForm,
            meaning: entry.meaning,
          }))}
          testID="cross-ref-related-grammar"
        />
      ) : null}
    </View>
  );
}
