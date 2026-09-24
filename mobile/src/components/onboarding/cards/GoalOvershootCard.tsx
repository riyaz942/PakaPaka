import React from 'react';

import { GuidanceCardBody } from '@/components/onboarding/cards/GuidanceCardBody';

/** Fires the first time Home's goal ring renders above 100% (FR55, FR57). */
export function GoalOvershootCard() {
  return (
    <GuidanceCardBody
      paragraphs={[
        'The ring keeps counting past 100%. Your daily goal is a number to beat, not a ceiling, so nothing you study after you reach it is wasted or uncounted.',
        "The target is today's new lessons plus today's reviews. Change how many new items you learn each day in Settings.",
      ]}
    />
  );
}
