import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ChatBubble } from '@/components/converse/ChatBubble';
import { Composer } from '@/components/converse/Composer';
import { PttOverlay } from '@/components/converse/PttOverlay';
import { VoiceModelDownloadPrompt } from '@/components/converse/VoiceModelDownloadPrompt';
import { WordLookupSheet } from '@/components/converse/WordLookupSheet';
import { buildChatWordSpans } from '@/core/ai/chatWordSpans';
import type { GrammarPromptTopic } from '@/core/ai/systemPrompt';
import { isOnline } from '@/data/ai/connectivity';
import { getChatWordIndex } from '@/data/curriculum/chatWordIndex';
import type { PassageWordSpan } from '@/data/curriculum/passageSpans';
import { areVoiceModelsDownloaded } from '@/data/ai/voice/modelDownloadManager';
import {
  getGrammarTopicById,
  listRecentGrammar,
} from '@/data/ai/recentGrammarRepository';
import { useAiConversation } from '@/data/hooks/useAiConversation';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { getAiSession } from '@/data/user/aiSessionRepository';
import { cn } from '@/utils/cn';

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
  const { userDb, curriculumDb } = useDatabase();
  // Insets do not cross into a react-native Modal on Android, so conversation
  // mode gets its own provider seeded with what this screen already measured.
  const safeAreaFrame = useSafeAreaFrame();
  const safeAreaInsets = useSafeAreaInsets();
  const { mode: furiganaMode, knownKanji, modeForItem, setOverride } = useFuriganaPreference();
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
      // Replay the set pinned at session start. Re-deriving "recent" here would
      // silently re-ground a resumed conversation in whatever the learner has
      // studied since.
      if (record.topicItemIds.length > 0) {
        const topics = record.topicItemIds
          .map((itemId) => getGrammarTopicById(userDb, itemId))
          .filter((topic): topic is NonNullable<typeof topic> => topic !== null);
        setGrammarTopics(topics);
        return;
      }
      // Sessions started before the set was pinned (migration 018) fall back to
      // the live list, which is the behaviour they were created under.
      if (record.mode === 'practise_recent_grammar') {
        setGrammarTopics(listRecentGrammar(userDb));
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
    retry,
    canRetry,
    end,
    dismissWrapUp,
  } = useAiConversation(sessionId, grammarTopics);

  const [lookupText, setLookupText] = useState<string | null>(null);
  // Conversation mode is another view over this same session, so a local flag
  // is the whole of it — no second data path, no Context for one boolean.
  const [mode, setMode] = useState<'chat' | 'ptt'>('chat');
  const [showVoiceDownload, setShowVoiceDownload] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showEndPrompt, setShowEndPrompt] = useState(false);
  const [endingReason, setEndingReason] = useState<'ai_wrap_up' | 'user_end' | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  /** Guards against a second mic tap racing the first presence check. */
  const micCheckRef = useRef(false);
  const ended = Boolean(session?.endedAt);

  const endPromptVisible = showEndPrompt || wrapUpSignalled;

  const grammarCaption = useMemo(() => {
    if (grammarTopics.length === 0) {
      return null;
    }
    const first = grammarTopics[0];
    if (grammarTopics.length === 1) {
      return `${first.primaryForm} · ${first.meaning}`;
    }
    return grammarTopics.map((topic) => topic.primaryForm).join(' · ');
  }, [grammarTopics]);

  useEffect(() => {
    if (wrapUpSignalled) {
      setShowEndPrompt(true);
      setEndingReason('ai_wrap_up');
    }
  }, [wrapUpSignalled]);

  // PTT is a covering Modal — wrap-up, session-ended, and offline UI live under
  // chat. Drop back so Finish / Keep talking / offline messaging stay reachable,
  // and clear the voice surfaces that no longer have a session to speak into.
  const pttBlocked = endPromptVisible || ended || online === false;
  // Read after an await, where the closure's copy would already be stale.
  const pttBlockedRef = useRef(pttBlocked);
  pttBlockedRef.current = pttBlocked;

  useEffect(() => {
    if (pttBlocked) {
      setMode('chat');
      setShowVoiceDownload(false);
      setVoiceError(null);
    }
  }, [pttBlocked]);

  async function handleFinish() {
    const reason = endingReason ?? (wrapUpSignalled ? 'ai_wrap_up' : 'user_end');
    await end(reason);
    setShowEndPrompt(false);
    setEndingReason(null);
    router.replace(`/converse/summary/${sessionId}`);
  }

  /**
   * Both routes into conversation mode land here rather than calling `setMode`
   * directly: the presence check and the download both resolve long after the
   * tap, by which time wrap-up, Finish, or going offline may have claimed the
   * screen — and the overlay would cover the only controls for those.
   */
  function enterPttMode() {
    setShowVoiceDownload(false);
    if (pttBlockedRef.current) {
      return;
    }
    // One presentation at a time: iOS drops a Modal raised over another.
    setLookupText(null);
    setMode('ptt');
  }

  /**
   * The mic is one entry point covering both states (FR90): enter conversation
   * mode when the models are there, prompt to fetch them when they are not.
   * Presence is read from disk on every tap rather than remembered.
   */
  async function handleMicPress() {
    if (micCheckRef.current) {
      return;
    }
    micCheckRef.current = true;
    setVoiceError(null);
    try {
      const downloaded = await areVoiceModelsDownloaded();
      if (!downloaded.ok) {
        setVoiceError(downloaded.error.userMessage ?? downloaded.error.message);
        return;
      }
      if (downloaded.value) {
        enterPttMode();
        return;
      }
      if (!pttBlockedRef.current) {
        setShowVoiceDownload(true);
      }
    } finally {
      micCheckRef.current = false;
    }
  }

  const latestAssistantText =
    [...messages].reverse().find((message) => message.role === 'assistant')?.content ?? null;

  // Curriculum words in each settled reply (Plan 15.1). Resolved here rather
  // than per bubble so the index is read once and a streaming re-render does not
  // re-match the whole transcript on every chunk.
  const wordSpansByMessage = useMemo(() => {
    const index = getChatWordIndex(curriculumDb);
    const spans = new Map<string, PassageWordSpan[]>();
    for (const message of messages) {
      if (message.role === 'assistant') {
        spans.set(message.id, buildChatWordSpans(message.content, index));
      }
    }
    return spans;
  }, [curriculumDb, messages]);

  function handleKeepTalking() {
    setShowEndPrompt(false);
    setEndingReason(null);
    dismissWrapUp();
  }

  const offlineBlock = (
    <View className="flex-1 items-center justify-center p-space-lg">
      <Icon name="offline" size={40} strokeWidth={1.75} className="text-muted" />
      <Text
        accessibilityRole="header"
        className="mt-space-md text-title font-ui-extrabold text-primary">
        Conversation needs internet
      </Text>
      <Text className="mt-space-sm text-center text-body font-ui text-secondary">
        Chat runs through the AI provider you configured, so this screen needs a connection.
      </Text>
    </View>
  );

  const conversationHeader = (
    <ScreenHeader backAccessibilityLabel="Leave conversation">
      <View className="flex-1 py-space-xs">
        <Text accessibilityRole="header" className="text-body-lg font-ui-extrabold text-primary">
          Conversation
        </Text>
        {grammarCaption ? (
          <Text className="text-caption font-ui-semibold text-content-grammar-deep">
            {grammarCaption}
          </Text>
        ) : null}
      </View>
    </ScreenHeader>
  );

  if (!sessionId) {
    return (
      <View className="flex-1 bg-background">
        {conversationHeader}
        <View className="flex-1 items-center justify-center p-space-lg">
          <Text className="text-body font-ui text-secondary">
            This conversation could not be found.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {conversationHeader}

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
              <Text className="mt-space-lg text-center text-body font-ui text-secondary">
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
                modeForItem={modeForItem}
                setOverride={setOverride}
                wordSpans={wordSpansByMessage.get(message.id)}
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
                modeForItem={modeForItem}
                setOverride={setOverride}
              />
            ) : null}

            {!ended && !endPromptVisible ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="End conversation"
                accessibilityState={{ disabled: isStreaming }}
                disabled={isStreaming}
                onPress={() => {
                  setEndingReason('user_end');
                  setShowEndPrompt(true);
                }}
                testID="end-session"
                className={cn(
                  'mt-space-md min-h-[44px] items-center justify-center self-center rounded-radius-full border border-border px-space-lg py-space-sm',
                  isStreaming && 'opacity-50',
                )}>
                <Text className="text-label font-ui-semibold text-muted">End conversation</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          {error ? (
            <View className="mx-space-md mb-space-sm rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
              <Text
                accessibilityLiveRegion="polite"
                className="text-body font-ui text-feedback-incorrect-deep">
                {error.userMessage ?? error.message}
              </Text>
              {/* Resending re-asks for a reply to the turn already sent, rather
                  than stacking another message onto a transcript that stalled. */}
              {canRetry ? (
                <Button
                  className="mt-space-md"
                  label="Resend"
                  onPress={() => {
                    void retry();
                  }}
                  testID="conversation-retry"
                  variant="secondary"
                />
              ) : null}
            </View>
          ) : null}

          {ended ? (
            <View className="mx-space-md mb-space-sm p-space-md">
              <Text className="text-body font-ui text-secondary">
                This conversation has finished.
              </Text>
              <Button
                className="mt-space-md"
                label="View session notes"
                onPress={() => router.replace(`/converse/summary/${sessionId}`)}
                variant="secondary"
              />
            </View>
          ) : endPromptVisible ? (
            <View className="mx-space-md mb-space-sm rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
              <Text className="text-body font-ui text-primary">
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
          ) : null}

          {voiceError ? (
            <View className="mx-space-md mb-space-sm rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
              <Text
                accessibilityLiveRegion="polite"
                className="text-body font-ui text-feedback-incorrect-deep">
                {voiceError}
              </Text>
            </View>
          ) : null}

          {showVoiceDownload ? (
            <View className="mx-space-md mb-space-sm">
              <VoiceModelDownloadPrompt
                onCancel={() => setShowVoiceDownload(false)}
                onDownloaded={enterPttMode}
              />
            </View>
          ) : null}

          {!ended ? (
            <Composer
              disabled={isStreaming || endPromptVisible}
              onSend={(text) => send(text)}
              onMicPress={() => {
                void handleMicPress();
              }}
            />
          ) : null}
        </KeyboardAvoidingView>
      )}

      {/*
        A full-screen Modal rather than a swapped-out view: conversation mode has
        to cover the tab bar too (UX-DR21), and the tab bar belongs to the parent
        navigator. The chat below stays mounted and untouched, which is why
        leaving needs no reconciliation.
      */}
      <Modal
        animationType="slide"
        visible={mode === 'ptt'}
        onRequestClose={() => setMode('chat')}>
        <SafeAreaProvider initialMetrics={{ frame: safeAreaFrame, insets: safeAreaInsets }}>
          <PttOverlay
            assistantText={latestAssistantText}
            conversationError={error ? (error.userMessage ?? error.message) : null}
            isStreaming={isStreaming}
            onSend={(text) => send(text)}
            onExit={() => setMode('chat')}
          />
        </SafeAreaProvider>
      </Modal>

      <WordLookupSheet
        visible={lookupText !== null}
        messageText={lookupText ?? ''}
        session={session ? { provider: session.provider, model: session.model } : null}
        onClose={() => setLookupText(null)}
      />
    </View>
  );
}
