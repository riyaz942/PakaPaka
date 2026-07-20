import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { EXPLAINER_CONTENT, type ExplainerTopic } from '@/components/learn/explainerContent';

type ExplainerSheetProps = {
  topic: ExplainerTopic;
  visible: boolean;
  onDismiss: () => void;
};

/**
 * Bottom sheet holding a section-heading explainer (FR73, UX-DR16).
 *
 * Uses the in-app RN `Modal` sheet pattern (`PassageWordDetailSheet`,
 * `SessionExitSheet`) rather than a new bottom-sheet dependency.
 */
export function ExplainerSheet({ topic, visible, onDismiss }: ExplainerSheetProps) {
  const content = EXPLAINER_CONTENT[topic];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      testID="explainer-sheet">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Dismiss ${content.title} explainer`}
        onPress={onDismiss}
        className="flex-1 bg-black/40"
      />
      <View className="max-h-[70%] gap-space-md rounded-t-radius-lg border-t border-border bg-surface p-space-lg">
        <Text accessibilityRole="header" className="text-title text-primary">
          {content.title}
        </Text>

        <ScrollView showsVerticalScrollIndicator>
          {content.paragraphs.map((paragraph, index) => (
            <Text
              key={index}
              className={index === 0 ? 'text-body text-secondary' : 'mt-space-md text-body text-secondary'}>
              {paragraph}
            </Text>
          ))}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${content.title} explainer`}
          onPress={onDismiss}
          testID="explainer-sheet-close"
          className="min-h-[44px] items-center justify-center rounded-radius-md">
          <Text className="text-body text-secondary">Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
