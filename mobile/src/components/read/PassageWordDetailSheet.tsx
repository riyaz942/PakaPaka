import { router, type Href } from 'expo-router';
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { AnnotatedText } from '@/components/common/AnnotatedText';
import { Button } from '@/components/common/Button';
import { ContentTypeBadge } from '@/components/common/ContentTypeBadge';
import { FuriganaText } from '@/components/common/FuriganaText';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import { conjugatedFormNote, type WordInflection } from '@/core/content/inflection';
import type { CurriculumItemDetail } from '@/data/curriculum/itemRepository';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { useIsKnownWord } from '@/data/hooks/useIsKnownWord';
import { useSheetFrame } from '@/hooks/useWideLayout';
import { cn } from '@/utils/cn';

type PassageWordDetailSheetProps = {
  /** The looked-up word, or null while nothing is selected. */
  item: CurriculumItemDetail | null;
  /** Surface form that was pressed, shown while the item is still resolving. */
  surface: string | null;
  /** Taught inflection of the pressed surface, when it was a conjugation. */
  inflection?: WordInflection | null;
  visible: boolean;
  onDismiss: () => void;
};

/**
 * In-place word lookup for the passage reader (FR70).
 *
 * "In place" means a sheet over the reader, never a forced navigation away —
 * the learner keeps their place in the text. The full item route stays
 * available as an optional secondary step.
 */
export function PassageWordDetailSheet({
  item,
  surface,
  inflection = null,
  visible,
  onDismiss,
}: PassageWordDetailSheetProps) {
  const sheetFrame = useSheetFrame();
  const { modeForItem, knownKanji } = useFuriganaPreference();
  // The sheet heroes the dictionary form, so a conjugated tap needs the bridge
  // back to what the learner actually pressed (14.1).
  const conjugatedNote = item
    ? conjugatedFormNote(surface, item.primaryForm, inflection)
    : null;
  const isVocabulary = item?.itemType === 'vocabulary';
  // Tier 1 only for vocabulary: a defined `isKnownWord` short-circuits Tier 2,
  // so kanji/radical/grammar must omit the prop and use knownKanji instead.
  const isKnownWord = useIsKnownWord(isVocabulary && item ? item.id : null);
  const accent = item ? CONTENT_TYPE_ACCENT[item.itemType] : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      testID="passage-word-detail-sheet">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss word details"
        onPress={onDismiss}
        className={cn('flex-1 bg-black/40', sheetFrame.backdropClassName)}
      />
      <View
        className={cn(
          'gap-space-md rounded-t-radius-xl border-t border-border bg-surface p-space-lg shadow-e3',
          sheetFrame.className,
        )}
        style={sheetFrame.style}>
        {item ? (
          <>
            <View className="flex-row items-start justify-between gap-space-md">
              <FuriganaText
                text={item.furigana ?? item.primaryForm}
                mode={modeForItem(item.id)}
                isKnownWord={isVocabulary ? isKnownWord : undefined}
                knownKanji={isVocabulary ? undefined : knownKanji}
                accessibilityRole="header"
                className={cn('text-title-lg font-jp-hero-bold', accent?.glyph)}
              />
              <ContentTypeBadge itemType={item.itemType} />
            </View>

            {conjugatedNote ? (
              <Text
                testID="passage-word-detail-conjugated-note"
                className="text-body-sm font-ui text-secondary">
                {conjugatedNote}
              </Text>
            ) : null}

            <Text className="text-body-lg font-ui-semibold text-primary">{item.meaning}</Text>

            {item.mnemonicText ? (
              <AnnotatedText
                text={item.mnemonicText}
                className="text-body text-secondary"
              />
            ) : null}

            <Button
              label="See full entry"
              variant="secondary"
              accessibilityLabel={`Open the full entry for ${item.primaryForm}`}
              onPress={() => {
                onDismiss();
                router.push(`/browse/item/${item.id}` as Href);
              }}
              testID="passage-word-detail-open-item"
            />
          </>
        ) : (
          <Text testID="passage-word-detail-missing" className="text-body text-secondary">
            {surface
              ? `No entry found for ${surface}.`
              : 'No entry found for this word.'}
          </Text>
        )}

        <Button
          label="Close"
          variant="ghost"
          accessibilityLabel="Close word details"
          onPress={onDismiss}
          testID="passage-word-detail-close"
        />
      </View>
    </Modal>
  );
}
