import {
  computeLoadIncrement,
  computeLoadPercent,
} from '@/core/cognitive-load/loadTracker';

describe('loadTracker', () => {
  describe('computeLoadIncrement', () => {
    it('assigns heavier load to apprentice kanji than mature vocabulary', () => {
      const kanji = computeLoadIncrement({
        itemType: 'kanji',
        stageLabel: 'apprentice',
        outcome: 'correct',
      });
      const vocab = computeLoadIncrement({
        itemType: 'vocabulary',
        stageLabel: 'guru',
        outcome: 'correct',
      });
      expect(kanji).toBeGreaterThan(vocab);
      expect(kanji).toBe(3);
      expect(vocab).toBe(1.4);
    });

    it('adds more load for incorrect than correct on the same item', () => {
      const correct = computeLoadIncrement({
        itemType: 'kanji',
        stageLabel: 'apprentice',
        outcome: 'correct',
      });
      const incorrect = computeLoadIncrement({
        itemType: 'kanji',
        stageLabel: 'apprentice',
        outcome: 'incorrect',
      });
      expect(incorrect).toBeGreaterThan(correct);
      expect(incorrect).toBe(4.5);
    });
  });

  describe('computeLoadPercent', () => {
    it('clamps percent to [0, 100] and rounds', () => {
      expect(computeLoadPercent(15, 30)).toBe(50);
      expect(computeLoadPercent(45, 30)).toBe(100);
      expect(computeLoadPercent(-5, 30)).toBe(0);
    });

    it('returns 0 when threshold is zero or negative', () => {
      expect(computeLoadPercent(10, 0)).toBe(0);
      expect(computeLoadPercent(10, -1)).toBe(0);
    });
  });
});
