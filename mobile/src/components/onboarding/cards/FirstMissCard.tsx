import React from 'react';

import { GuidanceCardBody } from '@/components/onboarding/cards/GuidanceCardBody';

/** Fires on the first review answer graded incorrect. Reframes, never consoles. */
export function FirstMissCard() {
  return (
    <GuidanceCardBody
      paragraphs={[
        'A wrong answer is not a strike against you. It tells the scheduler this item is not settled yet, so it comes back sooner instead of drifting further out.',
        'The correct answer appears straight away, and Continue records the miss. If what you typed was right in a way the app did not accept, the reveal offers to keep it as a synonym for next time.',
      ]}
    />
  );
}
