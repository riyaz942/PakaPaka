import React, { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { EXPLAINER_CONTENT, type ExplainerTopic } from '@/components/learn/explainerContent';

type ExplainerSheetBaseProps = {
  visible: boolean;
  onDismiss: () => void;
};

/**
 * Either a section-heading explainer topic (FR73, unchanged) or an arbitrary
 * titled body — the mode guidance cards use. Never both: a caller that supplies
 * a topic has nothing to add, and a caller that supplies children owns the copy.
 */
type ExplainerSheetProps =
  | (ExplainerSheetBaseProps & { topic: ExplainerTopic; title?: never; children?: never })
  | (ExplainerSheetBaseProps & { topic?: never; title: string; children: ReactNode });

/**
 * Bottom sheet holding a section-heading explainer (FR73, UX-DR16) or a
 * guidance card the learner tapped to open (Epic 7).
 *
 * Uses the in-app RN `Modal` sheet pattern (`PassageWordDetailSheet`,
 * `SessionExitSheet`) rather than a new bottom-sheet dependency.
 */
export function ExplainerSheet(props: ExplainerSheetProps) {
  const { visible, onDismiss } = props;

  // Topic mode owns its paragraph spacing (first paragraph flush, the rest
  // spaced); card mode hands that to the card body.
  const { title, body } =
    props.topic !== undefined
      ? resolveTopic(props.topic)
      : { title: props.title, body: props.children };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      testID="explainer-sheet">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Dismiss ${title} explainer`}
        onPress={onDismiss}
        className="flex-1 bg-black/40"
      />
      <View className="max-h-[70%] gap-space-md rounded-t-radius-xl border-t border-border bg-surface p-space-lg shadow-e3">
        <View className="h-1 w-10 self-center rounded-radius-full bg-border" />
        <Text accessibilityRole="header" className="text-title font-ui-bold text-primary">
          {title}
        </Text>

        <ScrollView showsVerticalScrollIndicator>{body}</ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title} explainer`}
          onPress={onDismiss}
          testID="explainer-sheet-close"
          className="min-h-[44px] items-center justify-center rounded-radius-md">
          <Text className="text-body font-ui-semibold text-brand-text">Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function resolveTopic(topic: ExplainerTopic): { title: string; body: ReactNode } {
  const content = EXPLAINER_CONTENT[topic];

  return {
    title: content.title,
    body: content.paragraphs.map((paragraph, index) => (
      <Text
        key={index}
        className={
          index === 0
            ? 'text-body font-ui text-secondary'
            : 'mt-space-md text-body font-ui text-secondary'
        }>
        {paragraph}
      </Text>
    )),
  };
}
