import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Icon } from '@/components/common/Icon';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import type { AiSessionRecord, ConversationMode } from '@/core/ai/aiSession.types';
import { isOnline } from '@/data/ai/connectivity';
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
 * start picker stays the primary empty state for starting something new.
 *
 * An unfinished or un-summarised session is still reachable here: abandoning
 * closes silently but never destroys the transcript. Listing itself is local;
 * opening a chat or generating notes still needs a connection.
 */
export default function ConversationHistoryScreen() {
  const { userDb } = useDatabase();
  const [sessions, setSessions] = useState<AiSessionRecord[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setSessions(listAiSessions(userDb));
      void isOnline().then((result) => {
        if (!cancelled) {
          setOnline(result);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [userDb]),
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Past conversations" backAccessibilityLabel="Back to Talk" />

      {online === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator accessibilityLabel="Checking connection" />
        </View>
      ) : online === false ? (
        <View className="flex-1 items-center justify-center p-space-lg">
          <Icon name="offline" size={40} strokeWidth={1.75} className="text-muted" />
          <Text
            accessibilityRole="header"
            className="mt-space-md text-title font-ui-extrabold text-primary">
            Conversation needs internet
          </Text>
          <Text className="mt-space-sm text-center text-body font-ui text-secondary">
            Opening a past chat or generating notes needs a connection. Everything else in the app
            still works offline.
          </Text>
        </View>
      ) : sessions.length === 0 ? (
        <View className="flex-1 items-center justify-center p-space-lg">
          <Text className="text-center text-body font-ui text-secondary">
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
              className="min-h-[44px] rounded-radius-lg border border-border bg-surface px-space-md py-space-md shadow-e1">
              <Text className="text-body font-ui-extrabold text-primary">
                {MODE_LABELS[session.mode]}
              </Text>
              <Text className="mt-space-xs text-caption font-ui-medium text-muted">
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
