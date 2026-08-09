import { GUIDANCE_CARDS } from '@/components/onboarding/cardRegistry';

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
});
