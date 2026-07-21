import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ConversationStartPicker,
  type ConversationStartRequest,
} from '@/components/converse/ConversationStartPicker';
import { KeySetup } from '@/components/converse/KeySetup';
import { getSemanticColors } from '@/constants/semantic-colors';
import { resolveActiveProvider } from '@/data/ai/aiConfig';
import { DEFAULT_MODELS } from '@/data/ai/byokCredential.types';
import { isOnline } from '@/data/ai/connectivity';
import {
  listAllGrammar,
  listRecentGrammar,
  type RecentGrammarItem,
} from '@/data/ai/recentGrammarRepository';
import { useByokStatus } from '@/data/hooks/useByokStatus';
import { useDatabase } from '@/data/hooks/useDatabase';
import { createAiSession } from '@/data/user/aiSessionRepository';
import { getAiModel } from '@/data/user/preferencesRepository';
import { resolveColorScheme } from '@/utils/resolve-color-scheme';

/**
 * The Conversation tab (FR87, UX-DR3, UX-DR21).
 *
 * Three states, in order of precedence: offline, unconfigured, ready. The
 * offline state is scoped to this tab only — every other tab stays fully usable
 * without a connection (UX-DR22).
 */
export default function ConverseScreen() {
  const insets = useSafeAreaInsets();
  const { userDb } = useDatabase();
  const colors = getSemanticColors(resolveColorScheme(useColorScheme()));
  const { configured, isReady, error: byokError, refresh } = useByokStatus();
  const [online, setOnline] = useState<boolean | null>(null);
  const [recentGrammar, setRecentGrammar] = useState<RecentGrammarItem[]>([]);
  const [allGrammar, setAllGrammar] = useState<RecentGrammarItem[]>([]);
  const [grammarLoadFailed, setGrammarLoadFailed] = useState(false);
  const startingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      refresh();

      void isOnline().then((result) => {
        if (!cancelled) {
          setOnline(result);
        }
      });

      try {
        setRecentGrammar(listRecentGrammar(userDb));
        setAllGrammar(listAllGrammar(userDb));
        setGrammarLoadFailed(false);
      } catch {
        // A failed read must not read as "you have no grammar" — the picker
        // says so and disables the grammar options rather than starting an
        // ungrounded session under a grammar label.
        setRecentGrammar([]);
        setAllGrammar([]);
        setGrammarLoadFailed(true);
      }

      return () => {
        cancelled = true;
      };
    }, [userDb, refresh]),
  );

  async function handleStart(request: ConversationStartRequest) {
    if (startingRef.current) {
      return;
    }

    const stillOnline = await isOnline();
    setOnline(stillOnline);
    if (!stillOnline) {
      return;
    }

    const provider = resolveActiveProvider(userDb, configured ?? []);
    if (!provider) {
      return;
    }

    startingRef.current = true;
    try {
      const session = createAiSession(userDb, {
        provider,
        model: getAiModel(userDb, provider) ?? DEFAULT_MODELS[provider],
        mode: request.mode,
        topicItemId: request.topicItemId ?? null,
        topicItemIds: request.topicItemIds ?? [],
      });
      router.push(`/converse/session/${session.id}`);
    } finally {
      startingRef.current = false;
    }
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-space-md py-space-sm">
        <Text accessibilityRole="header" className="text-title text-primary">
          Talk
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Past conversations"
          onPress={() => router.push('/converse/history')}
          testID="converse-history-entry"
          className="min-h-[44px] min-w-[44px] items-end justify-center"
          hitSlop={8}>
          <MaterialIcons name="history" size={24} color={colors.feedbackInfo} />
        </Pressable>
      </View>

      {online === null || !isReady ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator accessibilityLabel="Checking conversation readiness" />
        </View>
      ) : online === false ? (
        <View className="flex-1 items-center justify-center p-space-lg">
          <MaterialIcons name="cloud-off" size={40} color={colors.secondary} />
          <Text accessibilityRole="header" className="mt-space-md text-title text-primary">
            Conversation needs internet
          </Text>
          <Text className="mt-space-sm text-center text-body text-secondary">
            Chat runs through the AI provider you configured, so this tab needs a connection.
            Everything else in the app still works offline.
          </Text>
        </View>
      ) : byokError ? (
        <View className="flex-1 items-center justify-center p-space-lg">
          <Text accessibilityRole="header" className="text-title text-primary">
            Could not access secure storage
          </Text>
          <Text className="mt-space-sm text-center text-body text-secondary">
            {byokError.userMessage ?? byokError.message}
          </Text>
        </View>
      ) : (configured?.length ?? 0) === 0 ? (
        <KeySetup onSaved={refresh} />
      ) : (
        <ConversationStartPicker
          recentGrammar={recentGrammar}
          allGrammar={allGrammar}
          grammarLoadFailed={grammarLoadFailed}
          onStart={(request) => {
            void handleStart(request);
          }}
        />
      )}
    </View>
  );
}
