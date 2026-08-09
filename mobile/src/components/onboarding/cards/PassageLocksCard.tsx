import React from 'react';

import { GuidanceCardBody } from '@/components/onboarding/cards/GuidanceCardBody';

/** Fires when Browse first renders a locked passage row (FR60). */
export function PassageLocksCard() {
  return (
    <GuidanceCardBody
      paragraphs={[
        'A passage opens once at least 90% of the vocabulary and grammar it is built from has reached Guru or above. The lock marks how far off you are, not that the passage is off limits.',
        'The chip on the row counts how many more of that passage’s linked items still need to reach Guru. Every review of those items moves the count down.',
      ]}
    />
  );
}
