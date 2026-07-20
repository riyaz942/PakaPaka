import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ExplainerSheet } from '@/components/common/ExplainerSheet';
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
      <Text className="text-body-sm uppercase text-secondary">{label}</Text>

      {infoTopic ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`What does ${label} mean?`}
            onPress={() => setSheetVisible(true)}
            testID={`section-heading-info-${label.toLowerCase()}`}
            className="min-h-[44px] min-w-[44px] items-center justify-center">
            <Text className="text-body-sm text-feedback-info">ⓘ</Text>
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
