import React from 'react';
import { Text } from 'react-native';

import { Disclosure } from '@/components/common/Disclosure';
import type { AcceptedAnswer } from '@/data/curriculum/itemRepository';

type AcceptedAnswersDisclosureProps = {
  acceptedAnswers: AcceptedAnswer[];
};

export function curriculumSynonyms(acceptedAnswers: AcceptedAnswer[]): string[] {
  return acceptedAnswers
    .filter((answer) => answer.answerType === 'meaning' && !answer.isPrimary)
    .map((answer) => answer.answerText);
}

/**
 * Curriculum-authored alternative meanings, behind a disclosure (FR77).
 *
 * Named "Accepted answers" against the user's own "Your accepted answers"
 * editor: the two lists are different things (what the curriculum already
 * accepts vs. what you added), so they must never share a visible title.
 */
export function AcceptedAnswersDisclosure({
  acceptedAnswers,
}: AcceptedAnswersDisclosureProps) {
  const synonyms = curriculumSynonyms(acceptedAnswers);

  if (synonyms.length === 0) {
    return null;
  }

  return (
    <Disclosure label="Accepted answers" testID="accepted-answers-disclosure">
      <Text className="mt-1 text-body text-primary">{synonyms.join(', ')}</Text>
    </Disclosure>
  );
}
