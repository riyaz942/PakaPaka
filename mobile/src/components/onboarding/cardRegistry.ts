import type { ComponentType } from 'react';

import { ThreeScriptsCard } from '@/components/onboarding/cards/ThreeScriptsCard';
import { WordSpacingCard } from '@/components/onboarding/cards/WordSpacingCard';

/**
 * The single list of guidance cards (Epic 7).
 *
 * Three surfaces read this one array and differ only by how they filter it:
 * the day-1 deck takes `trigger === 'onboarding-deck'`, contextual triggers
 * take `'contextual'`, and the Settings "How this works" library lists all of
 * them. Adding a card is therefore one entry here — never a new screen, and
 * never a second list. Nothing outside this file should branch on a card id.
 *
 * Lives under `components/` rather than `core/`, where the epic sketches it:
 * `Render` is a React component, and `src/core/` holds no JSX and no imports
 * from `@/components`.
 */
export type GuidanceCardId = 'three-scripts' | 'word-spacing';

/** Closed set: what makes a card appear, not where it is rendered. */
export type GuidanceCardTrigger = 'onboarding-deck' | 'contextual' | 'library-only';

export type GuidanceCard = {
  id: GuidanceCardId;
  title: string;
  trigger: GuidanceCardTrigger;
  Render: ComponentType;
};

export const GUIDANCE_CARDS: readonly GuidanceCard[] = [
  {
    id: 'three-scripts',
    title: 'Three scripts, one language',
    trigger: 'onboarding-deck',
    Render: ThreeScriptsCard,
  },
  {
    id: 'word-spacing',
    title: 'No spaces between words',
    trigger: 'onboarding-deck',
    Render: WordSpacingCard,
  },
];
