import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ContentTypeBadge } from '@/components/common/ContentTypeBadge';
import { Icon } from '@/components/common/Icon';
import { GoalRing } from '@/components/engagement';
import { soft } from '@/constants/motion';
import type { ReviewItem } from '@/core/srs/srs.types';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';

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
  const a11yLabel = `Card ${displayNumber} of ${totalCards}, goal ${cognitiveLoadPercent} percent, ${itemType} card`;
  const { reducedMotion } = useReducedMotion();

  return (
    <View className="flex-row items-center px-space-md" style={{ height: 56 }}>
      <View
        accessible={true}
        accessibilityLabel={a11yLabel}
        className="flex-1 flex-row items-center gap-space-sm">
        <GoalRing variant="small" percent={cognitiveLoadPercent} />

        {/* Keyed on the number: each new count rises into place. */}
        <Animated.View
          key={displayNumber}
          entering={reducedMotion ? undefined : soft(FadeInDown)}>
          <Text className="text-body-lg font-ui-extrabold text-primary">
            {`${displayNumber} of ${totalCards}`}
          </Text>
        </Animated.View>

        <ContentTypeBadge itemType={itemType} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="End session"
        onPress={onExitPress}
        className="min-h-[44px] min-w-[44px] items-center justify-center">
        <Icon name="close" size={22} strokeWidth={2} className="text-muted" />
      </Pressable>
    </View>
  );
}
