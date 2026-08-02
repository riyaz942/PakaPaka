import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ExplainerSheet } from '@/components/common/ExplainerSheet';
import { Icon } from '@/components/common/Icon';
import type { ExplainerTopic } from '@/components/learn/explainerContent';

type SectionHeadingProps = {
  label: string;
  /** Adds an info affordance that opens the matching explainer sheet (FR73). */
  infoTopic?: ExplainerTopic;
  testID?: string;
};

/**
 * The one section heading used across lesson and details surfaces, replacing
 * the `text-body-sm uppercase text-secondary` heading duplicated per detail
 * component. Headings that name a piece of jargon carry an info affordance.
 */
export function SectionHeading({ label, infoTopic, testID }: SectionHeadingProps) {
  const [sheetVisible, setSheetVisible] = useState(false);

  return (
    <View className="flex-row items-center gap-space-xs" testID={testID}>
      {/* v2 kicker: 12px, extra-bold, tracked, faint — the section label sits
          quietly above its content instead of competing with it. */}
      <Text className="text-overline font-ui-bold uppercase tracking-[0.12em] text-faint">
        {label}
      </Text>

      {infoTopic ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`What does ${label} mean?`}
            onPress={() => setSheetVisible(true)}
            testID={`section-heading-info-${label.toLowerCase()}`}
            className="min-h-[44px] min-w-[44px] items-center justify-center">
            <Icon name="info" size={16} strokeWidth={2} className="text-brand-text" />
          </Pressable>
          <ExplainerSheet
            topic={infoTopic}
            visible={sheetVisible}
            onDismiss={() => setSheetVisible(false)}
          />
        </>
      ) : null}
    </View>
  );
}
