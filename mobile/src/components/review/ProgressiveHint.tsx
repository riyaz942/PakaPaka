import { useCallback, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';

import { HINT_BUTTON_LABEL, hintButtonLabel } from '@/config/constants';
import type { HintLevel } from '@/core/content/hintLevels';

type ProgressiveHintProps = {
  levels: HintLevel[];
  onReveal?: (revealedCount: number) => void;
};

export function ProgressiveHint({ levels, onReveal }: ProgressiveHintProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const total = levels.length;
  const exhausted = revealedCount >= total;

  const handleReveal = useCallback(() => {
    if (exhausted) return;

    const nextCount = revealedCount + 1;
    const level = levels[nextCount - 1];
    setRevealedCount(nextCount);
    onReveal?.(nextCount);

    AccessibilityInfo.announceForAccessibility(level.content);
    const remaining = total - nextCount;
    if (remaining > 0) {
      AccessibilityInfo.announceForAccessibility(`${remaining} hint${remaining === 1 ? '' : 's'} remaining`);
    }
  }, [exhausted, levels, onReveal, revealedCount, total]);

  if (total === 0) {
    return null;
  }

  const visibleLevels = levels.slice(0, revealedCount);

  return (
    <View className="gap-space-sm w-full">
      {visibleLevels.map((level, index) => (
        <View
          key={`hint-${index}`}
          testID="revealed-hint-panel"
          accessibilityLiveRegion="polite"
          className={`rounded-radius-md px-space-md py-space-sm ${
            level.isReinforcement ? 'bg-reinforcement-bg' : 'bg-surface-elevated'
          }`}>
          <Text
            className={`text-caption font-ui-medium ${
              level.isReinforcement ? 'text-reinforcement-text' : 'text-secondary'
            }`}>
            {level.content}
          </Text>
        </View>
      ))}

      {!exhausted ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hintButtonLabel(revealedCount, total)}
          className="min-h-[44px] justify-center self-center rounded-radius-md bg-surface px-space-md py-space-sm"
          onPress={handleReveal}>
          <Text className="text-body-sm font-ui-semibold text-brand-text">
            {revealedCount === 0 ? HINT_BUTTON_LABEL : hintButtonLabel(revealedCount, total)}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
