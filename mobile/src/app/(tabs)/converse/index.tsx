import React from 'react';
import { Text } from 'react-native';

import { TabPlaceholderScreen } from '@/components/common/TabPlaceholderScreen';

/**
 * Talk tab placeholder (UX-DR3). Holds the slot freed by removing the Read tab
 * until Epic 5 ships conversation practice. Deliberately inert — no BYOK key
 * setup, no chat surface, nothing that reaches the network.
 */
export default function ConverseScreen() {
  return (
    <TabPlaceholderScreen title="Conversation coming soon">
      <Text className="text-center text-body text-secondary">
        Practice speaking and chatting in Japanese will live here. Everything you study in
        Browse is getting you ready for it.
      </Text>
    </TabPlaceholderScreen>
  );
}
