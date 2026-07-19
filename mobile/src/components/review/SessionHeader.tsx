import { Pressable, Text, View } from 'react-native';

import { CognitiveLoadRing } from '@/components/engagement';
import { CONTENT_TYPE_ACCENT, CONTENT_TYPE_LABEL } from '@/constants/contentType';
import type { ReviewItem } from '@/core/srs/srs.types';

type ItemType = ReviewItem['itemType'];

type SessionHeaderProps = {
  /**
   * Cards completed (answered correctly at least once) — monotonic, never
   * backwards. Card-scoped, not item-scoped (FR86): a two-card kanji advances
   * this per card, never waiting on the pair's worst-of-both FSRS write.
   */
  cardsCompleted: number;
  /** Total cards in the session queue, after two-card kanji expansion. */
  totalCards: number;
  itemType: ItemType;
  cognitiveLoadPercent?: number;
  onExitPress: () => void;
};

export function SessionHeader({
  cardsCompleted,
  totalCards,
  itemType,
  cognitiveLoadPercent = 0,
  onExitPress,
}: SessionHeaderProps) {
  // Clamp: once every card is completed except in-flight retries, cardsCompleted
  // can equal totalCards while retry cards are still being shown.
  const displayNumber = Math.min(cardsCompleted + 1, totalCards);
  const accent = CONTENT_TYPE_ACCENT[itemType];
  const a11yLabel = `Card ${displayNumber} of ${totalCards}, cognitive load ${cognitiveLoadPercent} percent, ${itemType} card`;

  return (
    <View className="flex-row items-center px-space-md" style={{ height: 56 }}>
      <View
        accessible={true}
        accessibilityLabel={a11yLabel}
        className="flex-1 flex-row items-center gap-space-sm">
        <CognitiveLoadRing variant="small" percent={cognitiveLoadPercent} />

        <Text className="text-body font-semibold text-primary">
          {`${displayNumber} of ${totalCards}`}
        </Text>

        <View className={`rounded-radius-sm px-space-xs py-[2px] ${accent.tint}`}>
          <Text className={`text-overline font-semibold ${accent.text}`}>
            {CONTENT_TYPE_LABEL[itemType].toUpperCase()}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="End session"
        onPress={onExitPress}
        className="min-h-[44px] min-w-[44px] items-center justify-center">
        <Text className="text-title text-secondary">✕</Text>
      </Pressable>
    </View>
  );
}
