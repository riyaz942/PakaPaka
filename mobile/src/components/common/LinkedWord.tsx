import { router, type Href } from 'expo-router';
import React from 'react';
import { type AccessibilityActionEvent, Pressable, Text, View } from 'react-native';

import { FuriganaText, isWordFuriganaVisible } from '@/components/common/FuriganaText';
import { useItemHref } from '@/components/learn/ItemLinkContext';
import type { WordInflection } from '@/core/content/inflection';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { isVocabularyItemKnown } from '@/data/user/masteryRepository';
import { cn } from '@/utils/cn';

type LinkedWordProps = {
  /** Annotated text, e.g. `起[お]きます`. */
  text: string;
  /** The same text without furigana brackets. */
  surface: string;
  vocabularyItemId: string;
  inflection: WordInflection | null;
  /** Size and weight classes for the Japanese; colour is set here. */
  textClassName: string;
  testID: string;
  /** Closing punctuation kept in the same row, outside the pressable. */
  trailing?: string;
};

/**
 * One taught vocabulary word as a button (Plan 11.6 / 14.1): tap opens the
 * word's detail page, long-press toggles its furigana, and furigana follows
 * that word's own mastery (FR78). Shared by example sentences and lesson text.
 */
export function LinkedWord({
  text,
  surface,
  vocabularyItemId,
  inflection,
  textClassName,
  testID,
  trailing,
}: LinkedWordProps) {
  const { userDb } = useDatabase();
  const { knownKanji, modeForItem, setOverride } = useFuriganaPreference();
  const hrefFor = useItemHref();
  // A linked span *is* one vocabulary item, so its own mastery is the
  // whole answer (Tier 1) rather than a per-kanji check (Tier 2) — the
  // same distinction the word's own hero already uses (FR78 / BUG6).
  const isKnownWord = isVocabularyItemKnown(userDb, vocabularyItemId);

  const handlePress = (): void => {
    const pathname = hrefFor(vocabularyItemId);
    // A conjugated span opens the *base* word, so the detail screen is
    // told which surface sent the learner there (14.1).
    if (inflection) {
      router.push({ pathname, params: { surface, inflection } } as Href);
      return;
    }
    router.push(pathname as Href);
  };
  const handleToggleFurigana = (): void => {
    const visible = isWordFuriganaVisible(
      text,
      modeForItem(vocabularyItemId),
      knownKanji,
      isKnownWord,
    );
    setOverride(vocabularyItemId, visible ? 'hidden' : 'shown');
  };
  const handleAccessibilityAction = (event: AccessibilityActionEvent): void => {
    if (event.nativeEvent.actionName === 'toggleFurigana') {
      handleToggleFurigana();
      return;
    }
    handlePress();
  };

  const word = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${surface}, show word details`}
      accessibilityActions={[
        { name: 'activate', label: 'Show word details' },
        { name: 'toggleFurigana', label: 'Toggle furigana' },
      ]}
      onAccessibilityAction={handleAccessibilityAction}
      onPress={handlePress}
      onLongPress={handleToggleFurigana}
      testID={testID}>
      <FuriganaText
        text={text}
        // A linked span *is* one vocabulary item, so its per-word
        // override applies here just as it does on the word's own hero.
        mode={modeForItem(vocabularyItemId)}
        knownKanji={knownKanji}
        isKnownWord={isKnownWord}
        // Nested furigana toggles would steal the span tap (NFR29).
        interactive={false}
        className={cn(textClassName, 'text-content-vocabulary-deep underline')}
      />
    </Pressable>
  );

  if (!trailing) {
    return word;
  }

  return (
    <View className="flex-row items-end">
      {word}
      <Text className={cn(textClassName, 'text-primary')} accessible={false}>
        {trailing}
      </Text>
    </View>
  );
}
