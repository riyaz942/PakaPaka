import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

// Session-only memory (deliberately not persisted): once the user opens a
// mnemonic disclosure, later cards render expanded so a mnemonic reader
// doesn't tap once per lesson item. Resets on app restart.
let sessionExpanded = false;

export function __resetMnemonicSessionMemoryForTests() {
  sessionExpanded = false;
}

type MnemonicSectionProps = {
  mnemonicText: string;
  /**
   * Collapsed-by-default disclosure (lessons: the user is reading, not
   * recalling). Default false: always visible (Learn tab reference view).
   */
  collapsible?: boolean;
};

export function MnemonicSection({ mnemonicText, collapsible = false }: MnemonicSectionProps) {
  const [expanded, setExpanded] = useState(() => !collapsible || sessionExpanded);

  if (!collapsible) {
    return (
      <View className="mt-4">
        <Text className="text-body-sm uppercase text-secondary">Mnemonic</Text>
        <Text className="mt-1 text-body text-secondary">{mnemonicText}</Text>
      </View>
    );
  }

  const toggle = () => {
    setExpanded((value) => {
      const next = !value;
      sessionExpanded = next;
      return next;
    });
  };

  return (
    <View className="mt-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mnemonic"
        accessibilityState={{ expanded }}
        onPress={toggle}
        testID="mnemonic-disclosure"
        className="min-h-[44px] flex-row items-center gap-space-xs">
        <Text className="text-body-sm text-secondary">{expanded ? '▾' : '▸'}</Text>
        <Text className="text-body-sm uppercase text-secondary">Mnemonic</Text>
      </Pressable>
      {expanded ? (
        <Text className="text-body text-secondary" testID="mnemonic-disclosure-text">
          {mnemonicText}
        </Text>
      ) : null}
    </View>
  );
}
