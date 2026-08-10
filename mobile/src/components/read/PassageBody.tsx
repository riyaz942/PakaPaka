import React, { useMemo } from 'react';
import { type AccessibilityActionEvent, Pressable, View } from 'react-native';

import { FuriganaText, isWordFuriganaVisible } from '@/components/common/FuriganaText';
import type { WordInflection } from '@/core/content/inflection';
import { buildPassageBodyParts } from '@/core/content/passageBodyParts';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import type { PassageWordSpan } from '@/data/curriculum/passageSpans';

/**
 * The spec sets the body at 17px with 2.35 leading — neither is a type token,
 * and `FuriganaText` documents `style` as the escape hatch for exactly this.
 * The leading is held below 2.35 on purpose: readings here stack *above* the
 * line in their own view rather than sitting inside the line box as CSS ruby
 * does, so the wrap gap adds the rest of the spec's air.
 */
const PASSAGE_LINE_STYLE = { fontSize: 17, lineHeight: 30 };

type PassageBodyProps = {
  body: string;
  bodyFurigana: string | null;
  wordSpans: PassageWordSpan[];
  /**
   * `vocabularyItemId` is always the base word; `inflection` names the taught
   * form when the pressed surface is a conjugation of it (14.1).
   */
  onWordPress: (
    vocabularyItemId: string,
    surface: string,
    inflection: WordInflection | null,
  ) => void;
};

/**
 * The passage text, with authored word spans made pressable (FR70).
 *
 * NFR29 / UX-DR15 / OA7: a long press is never the only way in. Every spanned
 * word responds to a plain tap as well, is exposed as an
 * `accessibilityRole="button"` with a label naming the word and the action,
 * and carries an underline so the affordance is visible rather than hidden
 * behind a gesture the learner has to discover.
 *
 * Words without an authored span stay inert — the body is never
 * auto-segmented.
 */
export function PassageBody({
  body,
  bodyFurigana,
  wordSpans,
  onWordPress,
}: PassageBodyProps) {
  const { mode: furiganaMode, knownKanji, modeForItem, setOverride } = useFuriganaPreference();
  const parts = useMemo(
    () => buildPassageBodyParts(body, bodyFurigana, wordSpans),
    [body, bodyFurigana, wordSpans],
  );

  return (
    <View testID="passage-body" className="flex-row flex-wrap items-end">
      {parts.map((part, index) => {
        const key = `${index}-${part.surface}`;

        if (part.vocabularyItemId === null) {
          return (
            <FuriganaText
              key={key}
              text={part.text}
              mode={furiganaMode}
              knownKanji={knownKanji}
              className="font-jp text-primary"
              style={PASSAGE_LINE_STYLE}
            />
          );
        }

        const vocabularyItemId = part.vocabularyItemId;
        const handlePress = (): void =>
          onWordPress(vocabularyItemId, part.surface, part.inflection);
        const handleToggleFurigana = (): void => {
          const visible = isWordFuriganaVisible(
            part.text,
            modeForItem(vocabularyItemId),
            knownKanji,
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

        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`${part.surface}, show word details`}
            accessibilityActions={[
              { name: 'activate', label: 'Show word details' },
              { name: 'toggleFurigana', label: 'Toggle furigana' },
            ]}
            onAccessibilityAction={handleAccessibilityAction}
            onPress={handlePress}
            onLongPress={handleToggleFurigana}
            testID={`passage-word-${vocabularyItemId}-${index}`}>
            <FuriganaText
              text={part.text}
              // A word span *is* one vocabulary item, so hiding that word from
              // its detail sheet applies to the passage text too.
              mode={modeForItem(vocabularyItemId)}
              knownKanji={knownKanji}
              // Nested furigana toggles would steal the span tap (NFR29).
              interactive={false}
              className="font-jp text-content-vocabulary-deep underline"
              style={PASSAGE_LINE_STYLE}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
