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
      expect(resolvePromptType('radical', makeSrsState(0), '二')).toBe('meaning');
      expect(resolvePromptType('radical', makeSrsState(1), '二')).toBe('meaning');
      expect(resolvePromptType('radical', makeSrsState(5), '二')).toBe('meaning');
    });
  });

  describe('kanji', () => {
    it('returns reading when reps is even', () => {
      expect(resolvePromptType('kanji', makeSrsState(0), '一')).toBe('reading');
      expect(resolvePromptType('kanji', makeSrsState(2), '一')).toBe('reading');
      expect(resolvePromptType('kanji', makeSrsState(10), '一')).toBe('reading');
    });

    it('returns meaning when reps is odd', () => {
      expect(resolvePromptType('kanji', makeSrsState(1), '一')).toBe('meaning');
      expect(resolvePromptType('kanji', makeSrsState(3), '一')).toBe('meaning');
      expect(resolvePromptType('kanji', makeSrsState(9), '一')).toBe('meaning');
    });
  });

  describe('vocabulary', () => {
    it('returns reading when reps is even', () => {
      expect(resolvePromptType('vocabulary', makeSrsState(0), '食べる')).toBe('reading');
      expect(resolvePromptType('vocabulary', makeSrsState(4), '食べる')).toBe('reading');
    });

    it('returns meaning when reps is odd', () => {
      expect(resolvePromptType('vocabulary', makeSrsState(1), '食べる')).toBe('meaning');
      expect(resolvePromptType('vocabulary', makeSrsState(7), '食べる')).toBe('meaning');
    });

    it('always returns meaning for kana-only vocabulary regardless of parity', () => {
      expect(resolvePromptType('vocabulary', makeSrsState(0), 'これ')).toBe('meaning');
      expect(resolvePromptType('vocabulary', makeSrsState(1), 'これ')).toBe('meaning');
      expect(resolvePromptType('vocabulary', makeSrsState(2), 'あなた')).toBe('meaning');
      expect(resolvePromptType('vocabulary', makeSrsState(6), 'カメラ')).toBe('meaning');
    });

    it('treats mixed kanji-kana forms as kanji vocabulary', () => {
      expect(resolvePromptType('vocabulary', makeSrsState(0), '食べる')).toBe('reading');
    });
  });

  describe('grammar', () => {
    it('always returns production regardless of reps', () => {
      expect(resolvePromptType('grammar', makeSrsState(0), '〜です')).toBe('production');
      expect(resolvePromptType('grammar', makeSrsState(3), '〜です')).toBe('production');
      expect(resolvePromptType('grammar', makeSrsState(100), '〜です')).toBe('production');
    });
  });
});
