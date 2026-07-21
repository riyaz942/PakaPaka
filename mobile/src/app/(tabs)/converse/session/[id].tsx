import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ChatBubble } from '@/components/converse/ChatBubble';
import { Composer } from '@/components/converse/Composer';
import { WordLookupSheet } from '@/components/converse/WordLookupSheet';
import { useAiConversation } from '@/data/hooks/useAiConversation';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';

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
  const sessionId = String(id);
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();
  const {
    messages,
    pendingReply,
    isStreaming,
    wrapUpSignalled,
    error,
    send,
    end,
  } = useAiConversation(sessionId);

  const [lookupText, setLookupText] = useState<string | null>(null);
  const [showEndPrompt, setShowEndPrompt] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // The AI signalling a wrap-up raises exactly the same prompt as the End
  // button — the learner still chooses, it is not an automatic exit.
  useEffect(() => {
    if (wrapUpSignalled) {
      setShowEndPrompt(true);
    }
  }, [wrapUpSignalled]);

  function handleEnd(reason: 'ai_wrap_up' | 'user_end') {
    end(reason);
    setShowEndPrompt(false);
    router.replace(`/converse/summary/${sessionId}`);
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Conversation"
        backAccessibilityLabel="Leave conversation"
        // Leaving without ending is an abandon (FR94): silent, un-summarised,
        // and still resumable from the history list.
        onBack={() => {
          end('abandoned');
          router.back();
        }}
      />

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

        {showEndPrompt ? (
          <View className="mx-space-md mb-space-sm rounded-radius-md border border-border bg-surface p-space-md">
            <Text className="text-body text-primary">
              {wrapUpSignalled
                ? 'That felt like a natural place to stop. Finish up?'
                : 'End this conversation?'}
            </Text>
            <View className="mt-space-md flex-row gap-space-sm">
              <Button
                className="flex-1"
                label="Finish"
                onPress={() => handleEnd(wrapUpSignalled ? 'ai_wrap_up' : 'user_end')}
                testID="confirm-end-session"
              />
              <Button
                className="flex-1"
                label="Keep talking"
                onPress={() => setShowEndPrompt(false)}
                variant="secondary"
              />
            </View>
          </View>
        ) : (
          <View className="px-space-md pb-space-sm">
            <Button
              label="End conversation"
              onPress={() => setShowEndPrompt(true)}
              testID="end-session"
              variant="ghost"
            />
          </View>
        )}

        <Composer
          disabled={isStreaming}
          onSend={(text) => {
            void send(text);
          }}
        />
      </KeyboardAvoidingView>

      <WordLookupSheet
        visible={lookupText !== null}
        messageText={lookupText ?? ''}
        onClose={() => setLookupText(null)}
      />
    </View>
  );
}
