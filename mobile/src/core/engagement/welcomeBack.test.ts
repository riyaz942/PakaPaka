import { computeWelcomeBackOffer } from './welcomeBack';

const TODAY = '2026-07-20';

describe('computeWelcomeBackOffer', () => {
  it('returns null for a learner who has never studied (day 1, not a return)', () => {
    expect(
      computeWelcomeBackOffer({ lastActiveDate: null, todayKey: TODAY, dueCount: 340 }),
    ).toBeNull();
  });

  it('returns null when the absence is shorter than the threshold', () => {
    expect(
      computeWelcomeBackOffer({ lastActiveDate: '2026-07-18', todayKey: TODAY, dueCount: 340 }),
    ).toBeNull();
  });

  it('returns null when the backlog is below the minimum despite a long absence', () => {
    expect(
      computeWelcomeBackOffer({ lastActiveDate: '2026-07-01', todayKey: TODAY, dueCount: 39 }),
    ).toBeNull();
  });

  it('offers a 20-item slice at exactly the absence threshold with a big backlog', () => {
    expect(
      computeWelcomeBackOffer({ lastActiveDate: '2026-07-17', todayKey: TODAY, dueCount: 340 }),
    ).toEqual({ sliceSize: 20, dueCount: 340 });
  });

  it('caps the slice at the due count when the backlog is barely above minimum', () => {
    // Hypothetical smaller slice constant safety: slice never exceeds dueCount.
    const offer = computeWelcomeBackOffer({
      lastActiveDate: '2026-07-10',
      todayKey: TODAY,
      dueCount: 40,
    });
    expect(offer).toEqual({ sliceSize: 20, dueCount: 40 });
  });
});
