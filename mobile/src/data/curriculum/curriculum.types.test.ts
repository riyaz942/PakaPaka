import { isJlptLevel, JLPT_LEVELS } from '@/data/curriculum/curriculum.types';

describe('isJlptLevel', () => {
  it('accepts all canonical JLPT levels', () => {
    for (const level of JLPT_LEVELS) {
      expect(isJlptLevel(level)).toBe(true);
    }
  });

  it('rejects invalid values', () => {
    expect(isJlptLevel('n5')).toBe(false);
    expect(isJlptLevel('N0')).toBe(false);
    expect(isJlptLevel('N6')).toBe(false);
    expect(isJlptLevel('')).toBe(false);
    expect(isJlptLevel('beginner')).toBe(false);
  });
});
