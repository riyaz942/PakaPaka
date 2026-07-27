import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { getSemanticColors } from '@/constants/semantic-colors';
import type { AiSessionRecord, ConversationMode } from '@/core/ai/aiSession.types';
import { isOnline } from '@/data/ai/connectivity';
import { useDatabase } from '@/data/hooks/useDatabase';
import { listAiSessions } from '@/data/user/aiSessionRepository';
import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';

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
  const colors = getSemanticColors(usePaintedColorScheme());
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
          <MaterialIcons name="cloud-off" size={40} color={colors.secondary} />
          <Text accessibilityRole="header" className="mt-space-md text-title text-primary">
            Conversation needs internet
          </Text>
          <Text className="mt-space-sm text-center text-body text-secondary">
            Opening a past chat or generating notes needs a connection. Everything else in the app
            still works offline.
          </Text>
        </View>
      ) : sessions.length === 0 ? (
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
