import { computeLoadPercent } from '@/core/cognitive-load/loadTracker';

describe('loadTracker', () => {
  describe('computeLoadPercent', () => {
    it('floors at 0 and rounds', () => {
      expect(computeLoadPercent(15, 30)).toBe(50);
      expect(computeLoadPercent(-5, 30)).toBe(0);
    });

    it('does not clamp above 100 — overshoot is reported raw', () => {
      expect(computeLoadPercent(45, 30)).toBe(150);
      expect(computeLoadPercent(30, 30)).toBe(100);
      expect(computeLoadPercent(90, 30)).toBe(300);
    });

    it('returns 0 when threshold is zero or negative', () => {
      expect(computeLoadPercent(10, 0)).toBe(0);
      expect(computeLoadPercent(10, -1)).toBe(0);
    });
  });
});
