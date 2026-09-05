import React from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { useLessonOptIn } from '@/data/hooks/useLessonOptIn';

export type NotYetLearnedItem = {
  id: string;
  primaryForm: string;
};

function caption(items: NotYetLearnedItem[]): string {
  const forms = items.map((item) => item.primaryForm);
  return forms.length === 1
    ? `You haven't learned ${forms[0]} yet — it comes later in the course.`
    : `You haven't learned ${forms.join('、')} yet — they come later in the course.`;
}

/**
 * The footer under a component section that contains characters the learner has
 * not met: what they are, and the offer to pull one forward (untaught-kanji
 * plan, step 3).
 *
 * The button is a **queue** entry point, not a lesson entry point. It writes one
 * row to `lesson_opt_ins` and stays on this screen; the item shows up in a
 * future lesson. That is what keeps D-DET-1 ("details is never a lesson entry
 * point") and BUG7 ("details must never gate reading") intact — nothing here
 * navigates into a session, and nothing here is withheld until you press it.
 *
 * It is still a CTA on a surface that had none, which `StudyStatusBanner`'s
 * docstring records as a deliberate reversal.
 *
 * The item count is always on the button. The learner has already tuned their
 * goal ring, and a silent +2 is how a queue quietly stops being trustworthy.
 */
export function NotYetLearnedNote({
  items,
  testID,
}: {
  items: NotYetLearnedItem[];
  testID?: string;
}) {
  const { offers, toggle } = useLessonOptIn(items.map((item) => item.id));

  if (items.length === 0) {
    return null;
  }

  return (
    <View>
      <Text className="mt-space-sm text-caption text-muted" testID={testID}>
        {caption(items)}
      </Text>
      {items.map((item) => {
        const offer = offers.get(item.id);
        if (!offer) {
          return null;
        }
        return (
          <Button
            key={item.id}
            className="mt-space-sm self-start"
            variant={offer.isOptedIn ? 'tertiary' : 'secondary'}
            label={
              offer.isOptedIn
                ? `${item.primaryForm} added to your lessons — tap to remove`
                : `Learn ${item.primaryForm} now (+${offer.extraItemCount} ${
                    offer.extraItemCount === 1 ? 'item' : 'items'
                  })`
            }
            onPress={() => toggle(item.id)}
            testID={testID ? `${testID}-opt-in-${item.id}` : `opt-in-${item.id}`}
          />
        );
      })}
    </View>
  );
}
