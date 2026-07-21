import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ConversationSummary } from '@/components/converse/ConversationSummary';
import { useSessionSummary } from '@/data/hooks/useSessionSummary';

/**
 * Post-session summary (FR95, FR96). Generation is on demand — landing here
 * does not spend a request; the learner asks for it.
 */
export default function ConversationSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  const { summary, isCached, isGenerating, error, generate } = useSessionSummary(sessionId);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Session notes" backAccessibilityLabel="Back to conversations" />
      <ConversationSummary
        summary={summary}
        isCached={isCached}
        isGenerating={isGenerating}
        error={error}
        onGenerate={() => {
          void generate();
        }}
      />
    </View>
  );
}
