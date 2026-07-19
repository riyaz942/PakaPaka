import { combinePairGrades } from './pairGrading';

describe('combinePairGrades — worst-of-both (FR83)', () => {
  it('Again on either card drags the pair to Again', () => {
    expect(combinePairGrades(1, 3)).toBe(1);
    expect(combinePairGrades(3, 1)).toBe(1);
    expect(combinePairGrades(1, 1)).toBe(1);
  });

  it('a Hard card caps the pair at Hard (Story 5.4 hint rule preserved)', () => {
    expect(combinePairGrades(2, 3)).toBe(2);
    expect(combinePairGrades(3, 2)).toBe(2);
  });

  it('both clean-correct takes the lower shared grade', () => {
    expect(combinePairGrades(3, 3)).toBe(3);
    expect(combinePairGrades(3, 4)).toBe(3);
    expect(combinePairGrades(4, 4)).toBe(4);
  });
});
