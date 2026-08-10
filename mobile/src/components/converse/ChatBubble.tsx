import { router, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FuriganaText, isWordFuriganaVisible } from '@/components/common/FuriganaText';
import { useItemHref } from '@/components/learn/ItemLinkContext';
import type { ChatRole } from '@/core/ai/aiSession.types';
import { plainChatText } from '@/core/ai/chatWordSpans';
import { buildPassageBodyParts, type PassageBodyPart } from '@/core/content/passageBodyParts';
import type { PassageWordSpan } from '@/data/curriculum/passageSpans';
import type { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import type { FuriganaDisplayMode } from '@/data/user/preferencesRepository';

/** Assistant Japanese, one size above body copy so ruby has room. */
const ASSISTANT_JAPANESE = 'text-body-lg font-jp-medium';
const INERT_TEXT = `${ASSISTANT_JAPANESE} text-primary`;
const LINKED_WORD = `${ASSISTANT_JAPANESE} text-content-vocabulary-deep underline`;

/** Stable identity so the parts memo is not invalidated on every render. */
const NO_SPANS: PassageWordSpan[] = [];

type ChatBubbleProps = {
  role: ChatRole;
  text: string;
  furiganaMode: FuriganaDisplayMode;
  knownKanji?: ReadonlySet<string>;
  /** Opens the word-lookup sheet for this message. */
  onLookupWords?: () => void;
  /**
   * Curriculum words found in this reply (Plan 15.1), resolved by the session
   * screen against `getChatWordIndex`. The streaming preview passes none: half a
   * reply can hold half a bracket, so a partial surface would link to the wrong
   * word and flicker as the rest arrives.
   */
  wordSpans?: PassageWordSpan[];
  /** Per-word furigana state, for the long-press toggle on a linked word (15.2). */
  modeForItem: ReturnType<typeof useFuriganaPreference>['modeForItem'];
  setOverride: ReturnType<typeof useFuriganaPreference>['setOverride'];
};

/**
 * One turn in the transcript.
 *
 * Assistant replies render through the shared `FuriganaText` — the AI is
 * prompted to emit the same bracket notation the curriculum uses, and
 * `parseFurigana` already degrades malformed brackets to plain text without an
 * error, which is exactly the required behaviour (FR91/OA6).
 *
 * Words the curriculum knows are underlined and carry the same gesture split as
 * passages and example sentences (15.1/15.2): tap opens the word's details,
 * long-press hides or shows its furigana. Everything else in the reply stays
 * inert, and the whole-message lookup stays exactly where it was — a long-press
 * anywhere but a linked word, plus a visible button beneath the bubble — because
 * off-curriculum words are precisely what that sheet is for.
 *
 * a11y (NFR29): the bubble stays one readable element labelled with the whole
 * reply, so a screen reader hears a conversational turn as a sentence rather
 * than word by word. The linked words are therefore touch targets only, and the
 * non-gesture path to both of their operations runs through the visible "Look up
 * words" button — the sheet lists every word in the message and opens its
 * details, where the furigana override control lives. This is the one place the
 * 14.2 per-word `accessibilityActions` are deliberately not copied: in a passage
 * the text *is* the content and is already read span by span, so exposing each
 * word costs nothing there and everything here.
 */
export function ChatBubble({
  role,
  text,
  furiganaMode,
  knownKanji,
  onLookupWords,
  wordSpans = NO_SPANS,
  modeForItem,
  setOverride,
}: ChatBubbleProps) {
  const hrefFor = useItemHref();
  const parts = useMemo(
    () =>
      wordSpans.length === 0 ? [] : buildPassageBodyParts(plainChatText(text), text, wordSpans),
    [text, wordSpans],
  );

  if (role !== 'assistant') {
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
  const spokenLabel = plainChatText(text);
  const hasLinks = parts.some((part) => part.vocabularyItemId !== null);

  function openWord(itemId: string, part: PassageBodyPart): void {
    const pathname = hrefFor(itemId);
    // A conjugated surface opens the *base* word, so the detail screen is told
    // which surface sent the learner there (14.1).
    if (part.inflection) {
      router.push({
        pathname,
        params: { surface: part.surface, inflection: part.inflection },
      } as Href);
      return;
    }
    router.push(pathname as Href);
  }

  function toggleWordFurigana(itemId: string, part: PassageBodyPart): void {
    const visible = isWordFuriganaVisible(part.text, modeForItem(itemId), knownKanji ?? new Set());
    setOverride(itemId, visible ? 'hidden' : 'shown');
  }

  return (
    <View className="mb-space-sm max-w-[85%] self-start">
      <Pressable
        accessibilityRole="text"
        accessibilityLabel={spokenLabel}
        accessibilityHint={
          onLookupWords ? 'Long press to look up words in this message' : undefined
        }
        onLongPress={onLookupWords}
        delayLongPress={400}
        style={{ borderBottomLeftRadius: 5 }}
        className="rounded-radius-lg border border-border bg-surface px-space-md py-space-sm">
        {hasLinks ? (
          <View className="flex-row flex-wrap items-end" testID="chat-bubble-linked">
            {parts.map((part, index) => {
              const key = `${index}-${part.surface}`;
              const itemId = part.vocabularyItemId;

              if (itemId === null) {
                return (
                  <FuriganaText
                    key={key}
                    text={part.text}
                    mode={furiganaMode}
                    knownKanji={knownKanji}
                    className={INERT_TEXT}
                    interactive={false}
                  />
                );
              }

              return (
                <Pressable
                  key={key}
                  // The bubble above is the a11y element (see the component
                  // note) — this is a touch target layered over it.
                  accessible={false}
                  onPress={() => openWord(itemId, part)}
                  onLongPress={() => toggleWordFurigana(itemId, part)}
                  delayLongPress={400}
                  testID={`chat-word-${itemId}-${index}`}>
                  <FuriganaText
                    text={part.text}
                    // A linked span *is* one item, so its per-word override
                    // applies here just as it does on the word's own hero.
                    mode={modeForItem(itemId)}
                    knownKanji={knownKanji}
                    // Nested furigana toggles would steal the word's tap.
                    interactive={false}
                    className={LINKED_WORD}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <FuriganaText
            text={text}
            mode={furiganaMode}
            knownKanji={knownKanji}
            className={INERT_TEXT}
            // The bubble's own Pressable owns the gesture, so readings are not
            // individually tappable here.
            interactive={false}
          />
        )}
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
