import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { buildPassageBodyParts } from '@/core/content/passageBodyParts';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import type { PassageWordSpan } from '@/data/curriculum/passageSpans';

type PassageBodyProps = {
  body: string;
  bodyFurigana: string | null;
  wordSpans: PassageWordSpan[];
  onWordPress: (vocabularyItemId: string, surface: string) => void;
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
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();
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
              className="text-body-lg text-primary"
            />
          );
        }

        const vocabularyItemId = part.vocabularyItemId;
        const handlePress = (): void => onWordPress(vocabularyItemId, part.surface);

        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`${part.surface}, show word details`}
            accessibilityActions={[{ name: 'activate', label: 'Show word details' }]}
            onAccessibilityAction={handlePress}
            onPress={handlePress}
            onLongPress={handlePress}
            testID={`passage-word-${vocabularyItemId}-${index}`}>
            <FuriganaText
              text={part.text}
              mode={furiganaMode}
              knownKanji={knownKanji}
              // Nested furigana toggles would steal the span tap (NFR29).
              interactive={false}
              className="text-body-lg text-content-vocabulary underline"
            />
          </Pressable>
        );
      })}
    </View>
  );
}
