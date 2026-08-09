import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import type { GuidanceCard } from '@/components/onboarding/cardRegistry';

type GuidanceCardNoticeProps = {
  card: GuidanceCard;
  /** Passed through to the card; only `spaced-repetition` reads it. */
  subject?: string;
  onDismiss: () => void;
};

/**
 * A guidance card that fired on its own, rendered inline at the surface that
 * triggered it (Epic 7).
 *
 * Deliberately not a modal: the only thing that auto-appears during a review
 * today is `DailyThresholdNotice`, an inline banner, and a `Modal` opening on
 * the incorrect reveal would fight the screen's focus choreography. The rule is
 * uniform — triggered guidance appears in place, tapped guidance opens the
 * sheet. It never gates the action that triggered it and is always one tap to
 * dismiss.
 */
export function GuidanceCardNotice({ card, subject, onDismiss }: GuidanceCardNoticeProps) {
  const { Render } = card;

  return (
    <View
      accessibilityLiveRegion="polite"
      className="mt-space-md w-full gap-space-sm rounded-radius-lg border border-border bg-surface p-space-lg"
      testID="guidance-card-notice">
      <View className="flex-row items-start gap-space-sm">
        <Text
          accessibilityRole="header"
          className="flex-1 text-body-lg font-ui-bold text-primary">
          {card.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          hitSlop={8}
          testID="guidance-card-notice-dismiss"
          className="min-h-[44px] min-w-[44px] items-end justify-center">
          <Icon name="close" size={18} strokeWidth={2.2} className="text-muted" />
        </Pressable>
      </View>

      <View testID={`guidance-card-notice-${card.id}`}>
        <Render subject={subject} />
      </View>
    </View>
  );
}
