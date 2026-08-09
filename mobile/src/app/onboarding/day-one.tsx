import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';

import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { OnboardingStep } from '@/components/common/OnboardingStep';
import { GUIDANCE_CARDS } from '@/components/onboarding/cardRegistry';
import { useDatabase } from '@/data/hooks/useDatabase';
import { isCardSeen, markCardSeen } from '@/data/user/cardSeenRepository';

const DECK_CARDS = GUIDANCE_CARDS.filter((card) => card.trigger === 'onboarding-deck');

/**
 * The day-1 deck: the beginner path's short run of guidance cards before the
 * first lesson (Epic 7). It renders whatever the registry marks as deck cards —
 * no card id appears here, so a new card is one registry entry.
 */
export default function DayOneScreen() {
  const { userDb } = useDatabase();
  const navigatedRef = useRef(false);

  // Snapshotted at mount: each card is marked seen as it appears, so
  // re-filtering on every render would pull the current card off screen.
  const [cards] = useState(() => DECK_CARDS.filter((card) => !isCardSeen(userDb, card.id)));
  const [cardIndex, setCardIndex] = useState(0);

  const activeCard = cards[cardIndex] ?? null;
  const isLastCard = cardIndex === cards.length - 1;

  useEffect(() => {
    // Nothing left to show — Settings' "replay onboarding" clears the completion
    // flag but not `card_seen`, so an empty deck is a normal state, not an error.
    if (activeCard || navigatedRef.current) {
      return;
    }
    navigatedRef.current = true;
    router.replace('/onboarding/complete');
  }, [activeCard]);

  useEffect(() => {
    if (!activeCard) {
      return;
    }
    // Seen means shown, not dismissed: force-quitting mid-deck must not bring
    // the card back unprompted (same rule as the kanji reading primer).
    markCardSeen(userDb, activeCard.id);
  }, [userDb, activeCard]);

  if (!activeCard) {
    return null;
  }

  const CardBody = activeCard.Render;

  const handlePrimary = () => {
    if (isLastCard) {
      if (navigatedRef.current) {
        return;
      }
      navigatedRef.current = true;
      router.push('/onboarding/complete');
      return;
    }
    // Clamp: a double-tap inside one frame must not overshoot the deck and
    // strand the last card unshown and unmarked.
    setCardIndex((index) => Math.min(index + 1, cards.length - 1));
  };

  const handleSkip = () => {
    if (navigatedRef.current) {
      return;
    }
    navigatedRef.current = true;
    // Every deck card, not just the ones still on screen: skipping is a
    // statement about the deck, and the cards stay in the Settings library.
    for (const card of DECK_CARDS) {
      markCardSeen(userDb, card.id);
    }
    router.push('/onboarding/complete');
  };

  return (
    <OnboardingStep
      title={activeCard.title}
      stepIndex={3}
      stepCount={4}
      primaryAction={{ label: isLastCard ? 'Continue' : 'Next', onPress: handlePrimary }}
      skipAction={
        cardIndex === 0
          ? { label: 'Skip all, I know how apps work', onPress: handleSkip }
          : undefined
      }
      testID="day-one-screen">
      <FadeSlideIn key={activeCard.id} index={0}>
        <CardBody />
      </FadeSlideIn>
    </OnboardingStep>
  );
}
