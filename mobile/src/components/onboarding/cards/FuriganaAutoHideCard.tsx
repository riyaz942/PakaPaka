import React from 'react';

import { GuidanceCardBody } from '@/components/onboarding/cards/GuidanceCardBody';

/** Fires on the first mastered vocabulary word rendered with furigana hidden (FR78, FR79). */
export function FuriganaAutoHideCard() {
  return (
    <GuidanceCardBody
      paragraphs={[
        'The reading above a word disappears once you have learned that word. It keys on the word itself, never on the kanji inside it — a word can lose its reading while its component kanji are still new to you.',
        'Tap the word to peek at the reading; the peek is not remembered. To fix one word open or hidden for good, use the picker below, or change the app-wide default in Settings.',
      ]}
    />
  );
}
