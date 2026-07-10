import { resolvePromptType } from './promptResolver';
import type { SRSState } from './srs.types';

function makeSrsState(reps: number): SRSState {
  return {
    itemId: 'test-id',
    stability: 1,
    difficulty: 5,
    dueDate: new Date().toISOString(),
    fsrsState: 'new',
    reps,
    lapses: 0,
    learningSteps: 0,
    isBurned: false,
    srsStageLabel: 'apprentice',
    lastReviewedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

describe('resolvePromptType', () => {
  describe('radical', () => {
    it('always returns meaning regardless of reps', () => {
      expect(resolvePromptType('radical', makeSrsState(0))).toBe('meaning');
      expect(resolvePromptType('radical', makeSrsState(1))).toBe('meaning');
      expect(resolvePromptType('radical', makeSrsState(5))).toBe('meaning');
    });
  });

  describe('kanji', () => {
    it('returns reading when reps is even', () => {
      expect(resolvePromptType('kanji', makeSrsState(0))).toBe('reading');
      expect(resolvePromptType('kanji', makeSrsState(2))).toBe('reading');
      expect(resolvePromptType('kanji', makeSrsState(10))).toBe('reading');
    });

    it('returns meaning when reps is odd', () => {
      expect(resolvePromptType('kanji', makeSrsState(1))).toBe('meaning');
      expect(resolvePromptType('kanji', makeSrsState(3))).toBe('meaning');
      expect(resolvePromptType('kanji', makeSrsState(9))).toBe('meaning');
    });
  });

  describe('vocabulary', () => {
    it('returns reading when reps is even', () => {
      expect(resolvePromptType('vocabulary', makeSrsState(0))).toBe('reading');
      expect(resolvePromptType('vocabulary', makeSrsState(4))).toBe('reading');
    });

    it('returns meaning when reps is odd', () => {
      expect(resolvePromptType('vocabulary', makeSrsState(1))).toBe('meaning');
      expect(resolvePromptType('vocabulary', makeSrsState(7))).toBe('meaning');
    });
  });

  describe('grammar', () => {
    it('always returns production regardless of reps', () => {
      expect(resolvePromptType('grammar', makeSrsState(0))).toBe('production');
      expect(resolvePromptType('grammar', makeSrsState(3))).toBe('production');
      expect(resolvePromptType('grammar', makeSrsState(100))).toBe('production');
    });
  });
});
