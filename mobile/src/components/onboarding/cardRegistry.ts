import type { ComponentType } from 'react';

import { FirstMissCard } from '@/components/onboarding/cards/FirstMissCard';
import { FuriganaAutoHideCard } from '@/components/onboarding/cards/FuriganaAutoHideCard';
import { GoalOvershootCard } from '@/components/onboarding/cards/GoalOvershootCard';
import { PassageLocksCard } from '@/components/onboarding/cards/PassageLocksCard';
import { SpacedRepetitionCard } from '@/components/onboarding/cards/SpacedRepetitionCard';
import { ThreeScriptsCard } from '@/components/onboarding/cards/ThreeScriptsCard';
import { TwoCardKanjiCard } from '@/components/onboarding/cards/TwoCardKanjiCard';
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
export type GuidanceCardId =
  | 'three-scripts'
  | 'word-spacing'
  | 'first-miss'
  | 'spaced-repetition'
  | 'passage-locks'
  | 'goal-overshoot'
  | 'furigana-auto-hide'
  | 'two-card-kanji';

/** Closed set: what makes a card appear, not where it is rendered. */
export type GuidanceCardTrigger = 'onboarding-deck' | 'contextual' | 'library-only';

/**
 * A card may name the thing that triggered it. Only `spaced-repetition` reads
 * `subject`; every other card ignores it, and no card invents a stand-in when
 * it is absent (the Settings library passes nothing).
 */
export type GuidanceCardProps = { subject?: string };

export type GuidanceCard = {
  id: GuidanceCardId;
  title: string;
  trigger: GuidanceCardTrigger;
  Render: ComponentType<GuidanceCardProps>;
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
  {
    id: 'first-miss',
    title: 'Getting it wrong is the point',
    trigger: 'contextual',
    Render: FirstMissCard,
  },
  {
    id: 'spaced-repetition',
    title: 'Why items come back',
    trigger: 'contextual',
    Render: SpacedRepetitionCard,
  },
  {
    id: 'passage-locks',
    title: 'Locked passages are a destination',
    trigger: 'contextual',
    Render: PassageLocksCard,
  },
  {
    id: 'goal-overshoot',
    title: 'Past 100% is the good part',
    trigger: 'contextual',
    Render: GoalOvershootCard,
  },
  {
    id: 'furigana-auto-hide',
    title: 'Where the readings went',
    trigger: 'contextual',
    Render: FuriganaAutoHideCard,
  },
  {
    id: 'two-card-kanji',
    title: 'Why kanji ask twice',
    trigger: 'library-only',
    Render: TwoCardKanjiCard,
  },
];

/**
 * By-id view of the same array, for the surfaces that render one *named* card
 * (an affordance, a trigger). Derived — not a second list — so a new entry
 * above is reachable here with no further edit. The cast is the one place the
 * exhaustiveness of `Object.fromEntries` is asserted; `cardRegistry.test.ts`
 * checks it holds.
 */
export const GUIDANCE_CARD_BY_ID = Object.fromEntries(
  GUIDANCE_CARDS.map((card) => [card.id, card]),
) as Readonly<Record<GuidanceCardId, GuidanceCard>>;
