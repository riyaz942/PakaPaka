import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import type { ChatRole } from '@/core/ai/aiSession.types';
import { parseFurigana } from '@/core/furigana/parseFurigana';
import type { FuriganaDisplayMode } from '@/data/user/preferencesRepository';

type ChatBubbleProps = {
  role: ChatRole;
  text: string;
  furiganaMode: FuriganaDisplayMode;
  knownKanji?: ReadonlySet<string>;
  /** Opens the word-lookup sheet for this message. */
  onLookupWords?: () => void;
};

/**
 * One turn in the transcript.
 *
 * Assistant replies render through the shared `FuriganaText` — the AI is
 * prompted to emit the same bracket notation the curriculum uses, and
 * `parseFurigana` already degrades malformed brackets to plain text without an
 * error, which is exactly the required behaviour (FR91/OA6).
 *
 * Word lookup is reachable two ways (NFR29): a long-press on the bubble, and a
 * visible button beneath it for anyone who cannot or would rather not use the
 * gesture.
 */
export function ChatBubble({
  role,
  text,
  furiganaMode,
  knownKanji,
  onLookupWords,
}: ChatBubbleProps) {
  const isAssistant = role === 'assistant';

  if (!isAssistant) {
    // The tail is the one square-ish corner on the speaker's side (spec, Chat
    // bubbles) — the bubble points back at whoever said it.
    return (
      <View
        style={{ borderBottomRightRadius: 5 }}
        className="mb-space-sm max-w-[85%] self-end rounded-radius-lg bg-brand-600 px-space-md py-space-sm">
        <Text className="text-body-lg font-jp-medium text-on-primary">{text}</Text>
      </View>
    );
  }

  // Read the sentence, not its markup: the annotated form would have a screen
  // reader announcing every bracket around every reading.
  const spokenLabel = parseFurigana(text)
    .map((segment) => segment.text)
    .join('');

  return (
    <View className="mb-space-sm max-w-[85%] self-start">
      <Pressable
        accessibilityRole="text"
        accessibilityLabel={spokenLabel}
        accessibilityHint={onLookupWords ? 'Long press to look up words in this message' : undefined}
        onLongPress={onLookupWords}
        delayLongPress={400}
        style={{ borderBottomLeftRadius: 5 }}
        className="rounded-radius-lg border border-border bg-surface px-space-md py-space-sm">
        <FuriganaText
          text={text}
          mode={furiganaMode}
          knownKanji={knownKanji}
          className="text-body-lg font-jp-medium text-primary"
          // The bubble's own Pressable owns the gesture, so readings are not
          // individually tappable here.
          interactive={false}
        />
      </Pressable>

      {onLookupWords ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Look up words in this message"
          onPress={onLookupWords}
          testID="chat-bubble-lookup"
          className="mt-space-xs min-h-[44px] justify-center self-start px-space-xs">
          <Text className="text-caption font-ui-semibold text-brand-text">Look up words</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
