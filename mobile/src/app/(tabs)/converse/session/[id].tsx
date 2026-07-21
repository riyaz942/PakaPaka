import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ChatBubble } from '@/components/converse/ChatBubble';
import { Composer } from '@/components/converse/Composer';
import { WordLookupSheet } from '@/components/converse/WordLookupSheet';
import { getSemanticColors } from '@/constants/semantic-colors';
import type { GrammarPromptTopic } from '@/core/ai/systemPrompt';
import { isOnline } from '@/data/ai/connectivity';
import {
  getGrammarTopicById,
  listRecentGrammar,
} from '@/data/ai/recentGrammarRepository';
import { useAiConversation } from '@/data/hooks/useAiConversation';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { getAiSession } from '@/data/user/aiSessionRepository';
import { resolveColorScheme } from '@/utils/resolve-color-scheme';

/**
 * The chat surface (FR89–FR91, FR94).
 *
 * Ending is always available through the End button, and the AI's wrap-up
 * marker raises the same prompt — one path to the summary, whichever side
 * decided the scene was over. Navigating away instead abandons the session
 * silently: it stays un-summarised and resumable.
 */
export default function ConversationSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  const { userDb } = useDatabase();
  const colors = getSemanticColors(resolveColorScheme(useColorScheme()));
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();
  const [online, setOnline] = useState<boolean | null>(null);
  const [grammarTopics, setGrammarTopics] = useState<GrammarPromptTopic[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void isOnline().then((result) => {
        if (!cancelled) {
          setOnline(result);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    const record = getAiSession(userDb, sessionId);
    if (!record) {
      setGrammarTopics([]);
      return;
    }
    try {
      if (record.mode === 'practise_recent_grammar') {
        setGrammarTopics(listRecentGrammar(userDb));
        return;
      }
      if (record.mode === 'choose_grammar' && record.topicItemId) {
        const topic = getGrammarTopicById(userDb, record.topicItemId);
        setGrammarTopics(topic ? [topic] : []);
        return;
      }
      setGrammarTopics([]);
    } catch {
      setGrammarTopics([]);
    }
  }, [userDb, sessionId]);

  const {
    session,
    messages,
    pendingReply,
    isStreaming,
    wrapUpSignalled,
    error,
    send,
    end,
    dismissWrapUp,
  } = useAiConversation(sessionId, grammarTopics);

  const [lookupText, setLookupText] = useState<string | null>(null);
  const [showEndPrompt, setShowEndPrompt] = useState(false);
  const [endingReason, setEndingReason] = useState<'ai_wrap_up' | 'user_end' | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const ended = Boolean(session?.endedAt);

  const endPromptVisible = showEndPrompt || wrapUpSignalled;

  useEffect(() => {
    if (wrapUpSignalled) {
      setShowEndPrompt(true);
      setEndingReason('ai_wrap_up');
    }
  }, [wrapUpSignalled]);

  async function handleFinish() {
    const reason = endingReason ?? (wrapUpSignalled ? 'ai_wrap_up' : 'user_end');
    await end(reason);
    setShowEndPrompt(false);
    setEndingReason(null);
    router.replace(`/converse/summary/${sessionId}`);
  }

  function handleKeepTalking() {
    setShowEndPrompt(false);
    setEndingReason(null);
    dismissWrapUp();
  }

  const offlineBlock = useMemo(
    () => (
      <View className="flex-1 items-center justify-center p-space-lg">
        <MaterialIcons name="cloud-off" size={40} color={colors.secondary} />
        <Text accessibilityRole="header" className="mt-space-md text-title text-primary">
          Conversation needs internet
        </Text>
        <Text className="mt-space-sm text-center text-body text-secondary">
          Chat runs through the AI provider you configured, so this screen needs a connection.
        </Text>
      </View>
    ),
    [colors.secondary],
  );

  if (!sessionId) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Conversation" backAccessibilityLabel="Leave conversation" />
        <View className="flex-1 items-center justify-center p-space-lg">
          <Text className="text-body text-secondary">This conversation could not be found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Conversation"
        backAccessibilityLabel="Leave conversation"
        // Leaving without Finish is not an end (FR94): ended_at stays null so
        // history reopens this chat. Only the End / wrap-up Finish path ends it.
      />

      {online === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator accessibilityLabel="Checking connection" />
        </View>
      ) : online === false ? (
        offlineBlock
      ) : (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerClassName="p-space-md"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {messages.length === 0 && !isStreaming ? (
              <Text className="mt-space-lg text-center text-body text-secondary">
                Say something to get started — 日本語でどうぞ。
              </Text>
            ) : null}

            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                role={message.role}
                text={message.content}
                furiganaMode={furiganaMode}
                knownKanji={knownKanji}
                onLookupWords={
                  message.role === 'assistant' ? () => setLookupText(message.content) : undefined
                }
              />
            ))}

            {pendingReply.length > 0 ? (
              <ChatBubble
                role="assistant"
                text={pendingReply}
                furiganaMode={furiganaMode}
                knownKanji={knownKanji}
              />
            ) : null}
          </ScrollView>

          {error ? (
            <View className="mx-space-md mb-space-sm rounded-radius-md border border-border bg-surface p-space-md">
              <Text accessibilityLiveRegion="polite" className="text-body text-feedback-error">
                {error.userMessage ?? error.message}
              </Text>
            </View>
          ) : null}

          {ended ? (
            <View className="mx-space-md mb-space-sm p-space-md">
              <Text className="text-body text-secondary">This conversation has finished.</Text>
              <Button
                className="mt-space-md"
                label="View session notes"
                onPress={() => router.replace(`/converse/summary/${sessionId}`)}
                variant="secondary"
              />
            </View>
          ) : endPromptVisible ? (
            <View className="mx-space-md mb-space-sm rounded-radius-md border border-border bg-surface p-space-md">
              <Text className="text-body text-primary">
                {wrapUpSignalled || endingReason === 'ai_wrap_up'
                  ? 'That felt like a natural place to stop. Finish up?'
                  : 'End this conversation?'}
              </Text>
              <View className="mt-space-md flex-row gap-space-sm">
                <Button
                  className="flex-1"
                  label="Finish"
                  onPress={() => {
                    void handleFinish();
                  }}
                  testID="confirm-end-session"
                />
                <Button
                  className="flex-1"
                  label="Keep talking"
                  onPress={handleKeepTalking}
                  variant="secondary"
                />
              </View>
            </View>
          ) : (
            <View className="px-space-md pb-space-sm">
              <Button
                label="End conversation"
                onPress={() => {
                  setEndingReason('user_end');
                  setShowEndPrompt(true);
                }}
                testID="end-session"
                variant="ghost"
                disabled={isStreaming}
              />
            </View>
          )}

          {!ended ? (
            <Composer
              disabled={isStreaming || endPromptVisible}
              onSend={(text) => send(text)}
            />
          ) : null}
        </KeyboardAvoidingView>
      )}

      <WordLookupSheet
        visible={lookupText !== null}
        messageText={lookupText ?? ''}
        onClose={() => setLookupText(null)}
      />
    </View>
  );
}
