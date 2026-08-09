import {
  GUIDANCE_CARD_BY_ID,
  GUIDANCE_CARDS,
  type GuidanceCardTrigger,
} from '@/components/onboarding/cardRegistry';

const TRIGGERS: GuidanceCardTrigger[] = ['onboarding-deck', 'contextual', 'library-only'];

function idsWithTrigger(trigger: GuidanceCardTrigger): string[] {
  return GUIDANCE_CARDS.filter((card) => card.trigger === trigger).map((card) => card.id);
}

describe('GUIDANCE_CARDS', () => {
  it('has a unique id per card', () => {
    const ids = GUIDANCE_CARDS.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every card a title and something to render', () => {
    for (const card of GUIDANCE_CARDS) {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.Render).toBeDefined();
    }
  });

  it('ships exactly the two day-1 deck cards, in deck order', () => {
    const deck = GUIDANCE_CARDS.filter((card) => card.trigger === 'onboarding-deck');
    expect(deck.map((card) => card.id)).toEqual(['three-scripts', 'word-spacing']);
  });

  it('gives every card one of the three triggers', () => {
    for (const card of GUIDANCE_CARDS) {
      expect(TRIGGERS).toContain(card.trigger);
    }
  });

  it('ships exactly the five contextually triggered cards', () => {
    expect(idsWithTrigger('contextual')).toEqual([
      'first-miss',
      'spaced-repetition',
      'passage-locks',
      'goal-overshoot',
      'furigana-auto-hide',
    ]);
  });

  it('ships exactly one library-only card', () => {
    expect(idsWithTrigger('library-only')).toEqual(['two-card-kanji']);
  });

  it('exposes every card by id, with nothing extra', () => {
    const ids = GUIDANCE_CARDS.map((card) => card.id);
    expect(Object.keys(GUIDANCE_CARD_BY_ID).sort()).toEqual([...ids].sort());
    for (const card of GUIDANCE_CARDS) {
      expect(GUIDANCE_CARD_BY_ID[card.id]).toBe(card);
    }
  });
});
