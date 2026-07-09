import { Pressable, Text, View } from 'react-native';

import { CognitiveLoadRing } from '@/components/engagement';
import { CONTENT_TYPE_ACCENT, CONTENT_TYPE_LABEL } from '@/constants/contentType';
import type { ReviewItem } from '@/core/srs/srs.types';

type ItemType = ReviewItem['itemType'];

type SessionHeaderProps = {
  currentIndex: number;
  totalItems: number;
  itemType: ItemType;
  cognitiveLoadPercent?: number;
  onExitPress: () => void;
};

export function SessionHeader({
  currentIndex,
  totalItems,
  itemType,
  cognitiveLoadPercent = 0,
  onExitPress,
}: SessionHeaderProps) {
  const displayNumber = currentIndex + 1;
  const accent = CONTENT_TYPE_ACCENT[itemType];
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
