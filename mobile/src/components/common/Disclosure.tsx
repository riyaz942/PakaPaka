import React, { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type DisclosureProps = {
  label: string;
  children: ReactNode;
  /** Open on first render. Details sections default to collapsed. */
  defaultExpanded?: boolean;
  testID: string;
};

/**
 * Collapsed-by-default section for the details scroll (FR71): the page stays a
 * single vertical scroll, with dense reference blocks tucked behind a tap
 * rather than moved to another screen.
 */
export function Disclosure({
  label,
  children,
  defaultExpanded = false,
  testID,
}: DisclosureProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View className="mt-4" testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        testID={`${testID}-toggle`}
        className="min-h-[44px] flex-row items-center gap-space-xs">
        <Text className="text-body-sm text-secondary">{expanded ? '▾' : '▸'}</Text>
        <Text className="text-body-sm uppercase text-secondary">{label}</Text>
      </Pressable>
      {expanded ? <View testID={`${testID}-content`}>{children}</View> : null}
    </View>
  );
}
