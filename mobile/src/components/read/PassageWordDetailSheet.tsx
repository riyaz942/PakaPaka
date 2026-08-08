import { router, type Href } from 'expo-router';
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { AnnotatedText } from '@/components/common/AnnotatedText';
import { Button } from '@/components/common/Button';
import { ContentTypeBadge } from '@/components/common/ContentTypeBadge';
import { FuriganaText } from '@/components/common/FuriganaText';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { CurriculumItemDetail } from '@/data/curriculum/itemRepository';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { useIsKnownWord } from '@/data/hooks/useIsKnownWord';
import { cn } from '@/utils/cn';

type PassageWordDetailSheetProps = {
  /** The looked-up word, or null while nothing is selected. */
  item: CurriculumItemDetail | null;
  /** Surface form that was pressed, shown while the item is still resolving. */
  surface: string | null;
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
  visible,
  onDismiss,
}: PassageWordDetailSheetProps) {
  const { modeForItem, knownKanji } = useFuriganaPreference();
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
        className="flex-1 bg-black/40"
      />
      <View className="gap-space-md rounded-t-radius-xl border-t border-border bg-surface p-space-lg shadow-e3">
        {item ? (
          <>
            <View className="flex-row items-start justify-between gap-space-md">
              <FuriganaText
                text={item.furigana ?? item.primaryForm}
                mode={modeForItem(item.id)}
                isKnownWord={isVocabulary ? isKnownWord : undefined}
                knownKanji={isVocabulary ? undefined : knownKanji}
                accessibilityRole="header"
                className={cn('text-title-lg font-jp-hero-black', accent?.glyph)}
              />
              <ContentTypeBadge itemType={item.itemType} />
            </View>

            <Text className="text-body-lg font-ui-semibold text-primary">{item.meaning}</Text>

            {item.mnemonicText ? (
              <AnnotatedText
                text={item.mnemonicText}
                itemType={item.itemType}
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
