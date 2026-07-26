import React from 'react';
import { Text, View } from 'react-native';

import { AnnotatedText } from '@/components/common/AnnotatedText';
import { SectionHeading } from '@/components/common/SectionHeading';
import { MnemonicSection } from '@/components/learn/MnemonicSection';
import type {
  CurriculumItemDetail,
  CurriculumParentItem,
} from '@/data/curriculum/itemRepository';

type ItemMnemonicSectionsProps = {
  item: CurriculumItemDetail;
  /** Component parents from `useComponentParents` — the kanji composition line. */
  parents?: CurriculumParentItem[];
  /**
   * Rendered directly above the reading mnemonic. The lesson puts the kanji
   * readings here so the reading mnemonic never references unseen sounds
   * (Browse detail shows the readings higher up instead).
   */
  readingSlot?: React.ReactNode;
};

/** Whether the curriculum carries any mnemonic prose for this item. */
export function hasCurriculumMnemonic(item: CurriculumItemDetail): boolean {
  return Boolean(item.meaningMnemonic || item.readingMnemonic || item.mnemonicText);
}

/**
 * The curriculum's mnemonics for one item: split meaning/reading blocks
 * (content pipeline Rev 1) under a WaniKani-style composition line on kanji.
 *
 * Pre-Rev-1 content carries only the single `mnemonic_text` blob. That renders
 * through the legacy `MnemonicSection`, and only when neither split field is
 * present — the two are never merged into one block.
 */
export function ItemMnemonicSections({
  item,
  parents = [],
  readingSlot = null,
}: ItemMnemonicSectionsProps) {
  const hasSplitMnemonics = Boolean(item.meaningMnemonic || item.readingMnemonic);
  const compositionLine =
    item.itemType === 'kanji' && parents.length > 0
      ? `${parents.map((parent) => parent.primaryForm).join(' + ')} = ${item.primaryForm}`
      : null;

  return (
    <View testID="item-mnemonics">
      {compositionLine ? (
        <View className="mt-4" testID="kanji-composition-line">
          <Text className="text-body text-secondary">{compositionLine}</Text>
        </View>
      ) : null}

      {hasSplitMnemonics ? (
        <>
          {item.meaningMnemonic ? (
            <View className="mt-4" testID="meaning-mnemonic">
              <SectionHeading label="Meaning mnemonic" />
              <AnnotatedText
                text={item.meaningMnemonic}
                itemType={item.itemType}
                className="mt-1 text-body text-secondary"
              />
            </View>
          ) : null}

          {readingSlot}

          {item.readingMnemonic ? (
            <View className="mt-4" testID="reading-mnemonic">
              <SectionHeading label="Reading mnemonic" />
              <AnnotatedText
                text={item.readingMnemonic}
                itemType={item.itemType}
                className="mt-1 text-body text-secondary"
              />
            </View>
          ) : null}
        </>
      ) : (
        <>
          {item.mnemonicText ? <MnemonicSection mnemonicText={item.mnemonicText} /> : null}
          {readingSlot}
        </>
      )}
    </View>
  );
}
