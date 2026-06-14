import {
  convertBunproStageToFsrs,
  convertWaniKaniStageToFsrs,
  isSupportedBunproSrsStage,
  isSupportedWaniKaniSrsStage,
} from '@/core/import/fsrsConverter';

describe('fsrsConverter', () => {
  const now = new Date('2026-06-14T12:00:00.000Z');

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])('converts WK stage %i', (stage) => {
    expect(isSupportedWaniKaniSrsStage(stage)).toBe(true);

    const result = convertWaniKaniStageToFsrs(stage, now);
    expect(result).not.toBeNull();
    expect(result?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('maps burned stage to long-interval burned FSRS state', () => {
    const result = convertWaniKaniStageToFsrs(9, now);

    expect(result).toEqual({
      stability: 365,
      difficulty: 2,
      dueDate: '2036-06-11T12:00:00.000Z',
      state: 'review',
      reps: 5,
      lapses: 0,
      isBurned: true,
      srsStageLabel: 'burned',
    });
  });

  it('maps apprentice stages to short-interval states', () => {
    const apprentice1 = convertWaniKaniStageToFsrs(1, now);
    const apprentice4 = convertWaniKaniStageToFsrs(4, now);

    expect(apprentice1?.isBurned).toBe(false);
    expect(apprentice1?.srsStageLabel).toBe('apprentice');
    expect(apprentice1?.state).toBe('learning');
    expect(apprentice1?.dueDate).toBe('2026-06-14T16:00:00.000Z');

    expect(apprentice4?.isBurned).toBe(false);
    expect(apprentice4?.srsStageLabel).toBe('apprentice');
    expect(apprentice4?.state).toBe('review');
    expect(apprentice4?.dueDate).toBe('2026-06-16T12:00:00.000Z');
  });

  it('returns null for unsupported stages', () => {
    expect(convertWaniKaniStageToFsrs(0, now)).toBeNull();
    expect(convertWaniKaniStageToFsrs(10, now)).toBeNull();
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])('converts Bunpro stage %i', (stage) => {
    expect(isSupportedBunproSrsStage(stage)).toBe(true);

    const result = convertBunproStageToFsrs(stage, now);
    expect(result).not.toBeNull();
    expect(result?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('maps Bunpro burned stage to long-interval burned FSRS state', () => {
    const result = convertBunproStageToFsrs(9, now);

    expect(result).toEqual({
      stability: 365,
      difficulty: 2,
      dueDate: '2036-06-11T12:00:00.000Z',
      state: 'review',
      reps: 5,
      lapses: 0,
      isBurned: true,
      srsStageLabel: 'burned',
    });
  });

  it('maps Bunpro apprentice stages to short-interval states', () => {
    const apprentice1 = convertBunproStageToFsrs(1, now);
    const apprentice4 = convertBunproStageToFsrs(4, now);

    expect(apprentice1?.isBurned).toBe(false);
    expect(apprentice1?.srsStageLabel).toBe('apprentice');
    expect(apprentice1?.state).toBe('learning');
    expect(apprentice4?.state).toBe('review');
  });

  it('returns null for unsupported Bunpro stages', () => {
    expect(convertBunproStageToFsrs(0, now)).toBeNull();
    expect(convertBunproStageToFsrs(10, now)).toBeNull();
  });
});
