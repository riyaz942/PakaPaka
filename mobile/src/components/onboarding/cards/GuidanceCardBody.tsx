import React from 'react';
import { Text, View } from 'react-native';

/**
 * The prose body every guidance card renders through. Deliberately title-less:
 * the inline notice and the explainer sheet each draw their own heading from
 * the registry, so a card that carried one would double it up.
 */
export function GuidanceCardBody({ paragraphs }: { paragraphs: string[] }) {
  return (
    <View className="gap-space-sm" testID="guidance-card-body">
      {paragraphs.map((paragraph, index) => (
        <Text key={index} className="text-body font-ui text-secondary">
          {paragraph}
        </Text>
      ))}
    </View>
  );
}
