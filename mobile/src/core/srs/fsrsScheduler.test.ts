import { State } from 'ts-fsrs';

import {
  createInitialSrsState,
  fromFsrsCard,
  gradeItem,
  mapFsrsStateToStageLabel,
  toFsrsCard,
} from './fsrsScheduler';
import type { SRSState } from './srs.types';

const NOW = new Date('2026-06-27T10:00:00.000Z');

function makeState(overrides: Partial<SRSState> = {}): SRSState {
  return {
    itemId: '1',
    stability: 5,
    difficulty: 5,
    dueDate: NOW.toISOString(),
    fsrsState: 'review',
    reps: 3,
    lapses: 0,
    isBurned: false,
    srsStageLabel: 'guru',
    lastReviewedAt: null,
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function makeNewState(overrides: Partial<SRSState> = {}): SRSState {
  return {
    itemId: '1',
    stability: 0,
    difficulty: 0,
    dueDate: NOW.toISOString(),
    fsrsState: 'new',
    reps: 0,
    lapses: 0,
    isBurned: false,
    srsStageLabel: 'apprentice',
    lastReviewedAt: null,
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe('createInitialSrsState', () => {
  it('creates new-state seed with due date = now', () => {
    const state = createInitialSrsState('42', NOW);
    expect(state.itemId).toBe('42');
    expect(state.fsrsState).toBe('new');
    expect(state.isBurned).toBe(false);
    expect(state.srsStageLabel).toBe('apprentice');
    expect(state.dueDate).toBe(NOW.toISOString());
    expect(state.reps).toBe(0);
    expect(state.lapses).toBe(0);
  });
});

describe('toFsrsCard / fromFsrsCard round-trip', () => {
  it('preserves item identity through DB round-trip', () => {
    const original = makeState({ itemId: '99' });
    const card = toFsrsCard(original);
    const restored = fromFsrsCard(card, original);
    expect(restored.itemId).toBe('99');
    expect(restored.reps).toBe(original.reps);
    expect(restored.lapses).toBe(original.lapses);
  });

  it('falls back to updatedAt for last_review when lastReviewedAt is null and reps > 0', () => {
    const lastWeek = new Date('2026-06-20T10:00:00.000Z');
    const state = makeState({ reps: 5, lastReviewedAt: null, updatedAt: lastWeek.toISOString() });
    const card = toFsrsCard(state, NOW);
    expect(card.elapsed_days).toBeGreaterThan(0);
    expect(card.last_review).toEqual(lastWeek);
  });

  it('prefers lastReviewedAt over updatedAt for last_review', () => {
    const reviewedAt = new Date('2026-06-07T10:00:00.000Z');
    const importedAt = new Date('2026-06-26T10:00:00.000Z');
    const state = makeState({
      reps: 5,
      lastReviewedAt: reviewedAt.toISOString(),
      updatedAt: importedAt.toISOString(),
    });
    const card = toFsrsCard(state, NOW);
    expect(card.last_review).toEqual(reviewedAt);
    expect(card.elapsed_days).toBeCloseTo(20, 5);
  });

  it('gradeItem stamps lastReviewedAt', () => {
    const state = makeState({ lastReviewedAt: null });
    const result = gradeItem(state, 3, NOW);
    expect(result.lastReviewedAt).not.toBeNull();
  });

  it('maps fsrs_state string to State enum and back', () => {
    const configs: { fsrsState: SRSState['fsrsState']; stability: number; difficulty: number }[] = [
      { fsrsState: 'new', stability: 0, difficulty: 0 },
      { fsrsState: 'learning', stability: 1, difficulty: 5 },
      { fsrsState: 'review', stability: 10, difficulty: 5 },
      { fsrsState: 'relearning', stability: 2, difficulty: 5 },
    ];
    for (const cfg of configs) {
      const s = makeState(cfg);
      const card = toFsrsCard(s);
      const restored = fromFsrsCard(card, s);
      expect(restored.fsrsState).toBe(cfg.fsrsState);
    }
  });
});

describe('gradeItem', () => {
  it('Good grade on new card produces due date in the future', () => {
    const state = makeNewState();
    const result = gradeItem(state, 3, NOW);
    expect(result.dueDate > NOW.toISOString()).toBe(true);
  });

  it('Again grade on review card increases lapses', () => {
    const state = makeState({ reps: 5, lapses: 0, stability: 10, difficulty: 5 });
    const result = gradeItem(state, 1, NOW);
    expect(result.lapses).toBeGreaterThan(0);
  });

  it('Easy grade produces longer interval than Good grade', () => {
    const state = makeState({ stability: 10, difficulty: 5 });
    const good = gradeItem(state, 3, NOW);
    const easy = gradeItem(state, 4, NOW);
    expect(easy.dueDate > good.dueDate).toBe(true);
  });

  it('updates updatedAt to a recent timestamp', () => {
    const state = makeNewState();
    const before = new Date();
    const result = gradeItem(state, 3, NOW);
    const after = new Date();
    const updatedAt = new Date(result.updatedAt);
    expect(updatedAt >= before).toBe(true);
    expect(updatedAt <= after).toBe(true);
  });
});

describe('mapFsrsStateToStageLabel', () => {
  it('returns burned for isBurned=true regardless of stability', () => {
    const card = toFsrsCard(makeState({ stability: 5 }));
    expect(mapFsrsStateToStageLabel(card, true)).toBe('burned');
  });

  it('returns burned when stability >= 365', () => {
    const card = toFsrsCard(makeState({ stability: 365 }));
    expect(mapFsrsStateToStageLabel(card, false)).toBe('burned');
  });

  it('returns apprentice for new state', () => {
    const card = toFsrsCard(makeNewState());
    expect(mapFsrsStateToStageLabel(card, false)).toBe('apprentice');
  });

  it('returns apprentice for learning state', () => {
    const card = toFsrsCard(makeState({ fsrsState: 'learning', stability: 1, difficulty: 5 }));
    expect(mapFsrsStateToStageLabel(card, false)).toBe('apprentice');
  });

  it('returns apprentice for relearning state regardless of stability', () => {
    const card = {
      ...toFsrsCard(makeState({ fsrsState: 'relearning', stability: 30, difficulty: 5 })),
      state: State.Relearning,
    };
    expect(mapFsrsStateToStageLabel(card, false)).toBe('apprentice');
  });

  it('returns apprentice for review state with stability < 7 (import stages 3-4)', () => {
    const card = { ...toFsrsCard(makeState({ stability: 3, difficulty: 5 })), state: State.Review };
    expect(mapFsrsStateToStageLabel(card, false)).toBe('apprentice');
  });

  it('returns guru for review state with stability 7–20', () => {
    const card = { ...toFsrsCard(makeState({ stability: 10, difficulty: 5 })), state: State.Review };
    expect(mapFsrsStateToStageLabel(card, false)).toBe('guru');
  });

  it('returns master for review state with stability 21–119', () => {
    const card = { ...toFsrsCard(makeState({ stability: 50, difficulty: 5 })), state: State.Review };
    expect(mapFsrsStateToStageLabel(card, false)).toBe('master');
  });

  it('returns enlightened for review state with stability >= 120', () => {
    const card = { ...toFsrsCard(makeState({ stability: 200, difficulty: 5 })), state: State.Review };
    expect(mapFsrsStateToStageLabel(card, false)).toBe('enlightened');
  });
});

describe('fromFsrsCard burn handling', () => {
  it('preserves persisted isBurned when stability is below threshold', () => {
    const card = toFsrsCard(makeState({ stability: 10 }));
    const result = fromFsrsCard(card, makeState({ isBurned: true, stability: 10 }));
    expect(result.isBurned).toBe(true);
    expect(result.srsStageLabel).toBe('burned');
  });

  it('sets isBurned when stability reaches burn threshold', () => {
    const card = { ...toFsrsCard(makeState()), stability: 365 };
    const result = fromFsrsCard(card, makeState());
    expect(result.isBurned).toBe(true);
    expect(result.srsStageLabel).toBe('burned');
  });
});

describe('gradeItem burn transition', () => {
  it('sets isBurned=true and srsStageLabel=burned when stability reaches burn threshold', () => {
    const state = makeState({ stability: 364, difficulty: 1, reps: 20, fsrsState: 'review' });
    const result = gradeItem(state, 4, NOW);
    expect(result.stability).toBeGreaterThanOrEqual(365);
    expect(result.isBurned).toBe(true);
    expect(result.srsStageLabel).toBe('burned');
  });
});
