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

/**
 * Mnemonic and description prose across the detail scroll: 14px body copy in the
 * secondary tone, loosened a step so a paragraph with highlighted keywords in it
 * still reads as prose rather than as a dense block.
 */
export const MNEMONIC_PROSE = 'mt-space-xs text-body-sm font-ui leading-[1.55] text-secondary';

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
  // Skip tautologies like 三 = 三 (sole radical parent shares the kanji glyph).
  const showsComposition =
    item.itemType === 'kanji' &&
    parents.length > 0 &&
    !(parents.length === 1 && parents[0].primaryForm === item.primaryForm);
  const compositionLine = showsComposition
    ? `${parents.map((parent) => parent.primaryForm).join(' + ')} = ${item.primaryForm}`
    : null;

  return (
    <View testID="item-mnemonics">
      {compositionLine ? (
        <View className="mt-space-md" testID="kanji-composition-line">
          <Text className="text-body-sm font-jp-medium text-muted">{compositionLine}</Text>
        </View>
      ) : null}

      {hasSplitMnemonics ? (
        <>
          {item.meaningMnemonic ? (
            <View className="mt-space-md" testID="meaning-mnemonic">
              <SectionHeading label="Meaning mnemonic" />
              <AnnotatedText
                text={item.meaningMnemonic}
                className={MNEMONIC_PROSE}
              />
            </View>
          ) : null}

          {readingSlot}

          {item.readingMnemonic ? (
            <View className="mt-space-md" testID="reading-mnemonic">
              <SectionHeading label="Reading mnemonic" />
              <AnnotatedText
                text={item.readingMnemonic}
                className={MNEMONIC_PROSE}
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
