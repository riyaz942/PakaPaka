import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import type { AiSessionRecord, ConversationMode } from '@/core/ai/aiSession.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { listAiSessions } from '@/data/user/aiSessionRepository';

const MODE_LABELS: Record<ConversationMode, string> = {
  practise_recent_grammar: 'Recent grammar',
  choose_grammar: 'Chosen grammar',
  role_play: 'Role-play',
  random: 'Surprise topic',
};

function describeStatus(session: AiSessionRecord): string {
  if (session.summaryGeneratedAt) {
    return 'Notes ready';
  }
  if (session.endedAt) {
    return 'Finished — no notes yet';
  }
  return 'Unfinished';
}

/**
 * Past threads (FR89) — a secondary surface reached from the tab header. The
 * start picker stays the primary empty state for new sessions.
 *
 * An unfinished or un-summarised session is still reachable here: abandoning
 * closes silently but never destroys the transcript.
 */
export default function ConversationHistoryScreen() {
  const { userDb } = useDatabase();
  const [sessions, setSessions] = useState<AiSessionRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      setSessions(listAiSessions(userDb));
    }, [userDb]),
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Past conversations" backAccessibilityLabel="Back to Talk" />

      {sessions.length === 0 ? (
        <View className="flex-1 items-center justify-center p-space-lg">
          <Text className="text-center text-body text-secondary">
            No conversations yet. Start one from the Talk tab.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="p-space-md gap-space-sm">
          {sessions.map((session) => (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              accessibilityLabel={`${MODE_LABELS[session.mode]} conversation, ${describeStatus(session)}`}
              onPress={() =>
                router.push(
                  session.endedAt
                    ? `/converse/summary/${session.id}`
                    : `/converse/session/${session.id}`,
                )
              }
              testID={`history-session-${session.id}`}
              className="min-h-[44px] rounded-radius-md border border-border bg-surface px-space-md py-space-md">
              <Text className="text-body font-semibold text-primary">
                {MODE_LABELS[session.mode]}
              </Text>
              <Text className="mt-space-xs text-body-sm text-secondary">
                {new Date(session.startedAt).toLocaleDateString()} · {session.turnCount} turns ·{' '}
                {describeStatus(session)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
