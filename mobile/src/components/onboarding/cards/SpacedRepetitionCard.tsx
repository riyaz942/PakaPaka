import React from 'react';

import type { GuidanceCardProps } from '@/components/onboarding/cardRegistry';
import { GuidanceCardBody } from '@/components/onboarding/cards/GuidanceCardBody';

/**
 * The only card that reads `subject`. Two authored modes, not one degraded:
 * triggered on a repeat review it names the item on screen; opened from the
 * Settings library it starts at the general explanation. No stand-in item is
 * invented for the second case.
 */
export function SpacedRepetitionCard({ subject }: GuidanceCardProps) {
  return (
    <GuidanceCardBody
      paragraphs={[
        ...(subject
          ? [`You have met ${subject} before — this is that item coming back, not a new one.`]
          : []),
        'Answering correctly pushes the next sighting further out: minutes, then hours, then days, then weeks. Missing it pulls the item back in close.',
        'The stage name under the prompt tracks how far apart those sightings have got — Apprentice, Guru, Master, Enlightened, then Burned, at which point the item stops coming back.',
      ]}
    />
  );
}
