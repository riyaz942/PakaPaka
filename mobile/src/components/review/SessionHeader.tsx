import { Pressable, Text, View } from 'react-native';

import { CognitiveLoadRing } from '@/components/engagement';
import type { ReviewItem } from '@/core/srs/srs.types';

type ItemType = ReviewItem['itemType'];

type SessionHeaderProps = {
  currentIndex: number;
  totalItems: number;
  itemType: ItemType;
  cognitiveLoadPercent?: number;
  onExitPress: () => void;
};

const BADGE_TEXT: Record<ItemType, string> = {
  radical: 'RADICAL',
  kanji: 'KANJI',
  vocabulary: 'VOCABULARY',
  grammar: 'GRAMMAR',
};

const BADGE_CLASSES: Record<ItemType, { text: string; bg: string }> = {
  radical: { text: 'text-content-radical', bg: 'bg-content-radical/15' },
  kanji: { text: 'text-content-kanji', bg: 'bg-content-kanji/15' },
  vocabulary: { text: 'text-content-vocabulary', bg: 'bg-content-vocabulary/15' },
  grammar: { text: 'text-content-grammar', bg: 'bg-content-grammar/15' },
};

export function SessionHeader({
  currentIndex,
  totalItems,
  itemType,
  cognitiveLoadPercent = 0,
  onExitPress,
}: SessionHeaderProps) {
  const displayNumber = currentIndex + 1;
  const badge = BADGE_CLASSES[itemType];
  const a11yLabel = `Item ${displayNumber} of ${totalItems}, cognitive load ${cognitiveLoadPercent} percent, ${itemType} item`;

  return (
    <View className="flex-row items-center px-space-md" style={{ height: 56 }}>
      <View
        accessible={true}
        accessibilityLabel={a11yLabel}
        className="flex-1 flex-row items-center gap-space-sm">
        <CognitiveLoadRing variant="small" percent={cognitiveLoadPercent} />

        <Text className="text-body font-semibold text-primary">
          {`${displayNumber} of ${totalItems}`}
        </Text>

        <View className={`rounded-radius-sm px-space-xs py-[2px] ${badge.bg}`}>
          <Text className={`text-overline font-semibold ${badge.text}`}>
            {BADGE_TEXT[itemType]}
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
