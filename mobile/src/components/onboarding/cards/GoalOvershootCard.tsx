import React from 'react';

import { GuidanceCardBody } from '@/components/onboarding/cards/GuidanceCardBody';

/** Fires the first time Home's goal ring renders above 100% (FR55, FR57). */
export function GoalOvershootCard() {
  return (
    <GuidanceCardBody
      paragraphs={[
        'The ring keeps counting past 100%. Your daily goal is a number to beat, not a ceiling, so nothing you study after you reach it is wasted or uncounted.',
        'The target itself only changes when you agree to it. After a stretch of comfortable days the app offers a higher one and waits for your answer — it never moves on its own.',
      ]}
    />
  );
}
