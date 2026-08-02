import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { SectionHeading } from '@/components/common/SectionHeading';
import { MNEMONIC_PROSE } from '@/components/learn/ItemMnemonicSections';

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
      <View className="mt-space-md">
        <SectionHeading label="Mnemonic" />
        <Text className={MNEMONIC_PROSE}>{mnemonicText}</Text>
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
    <View className="mt-space-md">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mnemonic"
        accessibilityState={{ expanded }}
        onPress={toggle}
        testID="mnemonic-disclosure"
        className="min-h-[44px] flex-row items-center gap-space-xs">
        <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
          <Icon name="chevron" size={14} strokeWidth={2.4} className="text-muted" />
        </View>
        <Text className="text-overline font-ui-bold uppercase tracking-[0.12em] text-faint">
          Mnemonic
        </Text>
      </Pressable>
      {expanded ? (
        <Text className={MNEMONIC_PROSE} testID="mnemonic-disclosure-text">
          {mnemonicText}
        </Text>
      ) : null}
    </View>
  );
}
