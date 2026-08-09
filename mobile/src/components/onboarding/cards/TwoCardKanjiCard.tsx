import React from 'react';

import { GuidanceCardBody } from '@/components/onboarding/cards/GuidanceCardBody';

/** Library-only: never fires unprompted, reached from the review card header (FR81, FR83). */
export function TwoCardKanjiCard() {
  return (
    <GuidanceCardBody
      paragraphs={[
        'Every kanji you study becomes two review cards: one asks for the meaning, the other for the on’yomi reading. They are scheduled as a pair, so the kanji only moves on once both have been answered.',
        'The pair is graded on the worse of the two answers, applied once. Getting one side wrong counts as a single miss for the kanji, not two.',
        'Kun’yomi readings are not drilled on their own. You pick those up through the vocabulary words that use them.',
      ]}
    />
  );
}
