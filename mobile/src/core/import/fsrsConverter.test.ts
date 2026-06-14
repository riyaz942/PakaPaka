import {
  convertAnkiCardToFsrs,
  convertBunproStageToFsrs,
  convertWaniKaniStageToFsrs,
  isSupportedBunproSrsStage,
  isSupportedWaniKaniSrsStage,
} from '@/core/import/fsrsConverter';
import type { AnkiCard } from '@/core/import/import.types';

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

  function buildAnkiCard(overrides: Partial<AnkiCard> = {}): AnkiCard {
    return {
      id: 1,
      nid: 1,
      did: 1,
      ivl: 7,
      factor: 2500,
      reps: 3,
      lapses: 0,
      queue: 2,
      type: 2,
      ...overrides,
    };
  }

  it('returns null for brand-new Anki cards with no review history', () => {
    expect(convertAnkiCardToFsrs(buildAnkiCard({ type: 0, reps: 0, ivl: 0 }), now)).toBeNull();
  });

  it('converts learning cards with negative intervals in seconds', () => {
    const result = convertAnkiCardToFsrs(
      buildAnkiCard({ type: 1, queue: 1, ivl: -600, reps: 1 }),
      now,
    );

    expect(result).toMatchObject({
      state: 'learning',
      stability: expect.any(Number),
      dueDate: '2026-06-14T12:10:00.000Z',
      isBurned: false,
    });
  });

  it('converts review cards with interval-based stability and ease-derived difficulty', () => {
    const easy = convertAnkiCardToFsrs(buildAnkiCard({ factor: 3500, ivl: 30 }), now);
    const hard = convertAnkiCardToFsrs(buildAnkiCard({ factor: 1300, ivl: 30 }), now);

    expect(easy?.state).toBe('review');
    expect(easy?.stability).toBe(30);
    expect(easy?.difficulty).toBeLessThan(hard?.difficulty ?? 10);
    expect(easy?.dueDate).toBe('2026-07-14T12:00:00.000Z');
  });

  it('marks very mature review cards as burned', () => {
    const result = convertAnkiCardToFsrs(buildAnkiCard({ ivl: 400, type: 2, queue: 2 }), now);

    expect(result).toMatchObject({
      state: 'review',
      isBurned: true,
      stability: 365,
      srsStageLabel: 'burned',
    });
  });

  it('converts relearning cards', () => {
    const result = convertAnkiCardToFsrs(
      buildAnkiCard({ type: 3, queue: 1, ivl: -120, reps: 4 }),
      now,
    );

    expect(result?.state).toBe('relearning');
    expect(result?.dueDate).toBe('2026-06-14T12:02:00.000Z');
  });

  it('imports suspended and buried cards with current interval state', () => {
    const suspended = convertAnkiCardToFsrs(
      buildAnkiCard({ queue: -1, ivl: 21, type: 2 }),
      now,
    );
    const buried = convertAnkiCardToFsrs(
      buildAnkiCard({ queue: -2, ivl: 10, type: 2 }),
      now,
    );

    expect(suspended?.state).toBe('review');
    expect(buried?.state).toBe('review');
    expect(suspended?.isBurned).toBe(false);
  });

  it('handles zero-interval and extreme ease factor edge cases', () => {
    const zeroInterval = convertAnkiCardToFsrs(buildAnkiCard({ ivl: 0, type: 2 }), now);
    const maxEase = convertAnkiCardToFsrs(buildAnkiCard({ factor: 5000 }), now);
    const minEase = convertAnkiCardToFsrs(buildAnkiCard({ factor: 500 }), now);

    expect(zeroInterval?.stability).toBe(0.5);
    expect(maxEase?.difficulty).toBe(2);
    expect(minEase?.difficulty).toBe(10);
  });
});
