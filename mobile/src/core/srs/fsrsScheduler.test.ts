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
    learningSteps: 0,
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
    learningSteps: 0,
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

  it('stamps updatedAt and lastReviewedAt with the review time', () => {
    const state = makeNewState();
    const result = gradeItem(state, 3, NOW);
    expect(result.updatedAt).toBe(NOW.toISOString());
    expect(result.lastReviewedAt).toBe(NOW.toISOString());
  });
});

describe('learning-step graduation (Plan 01 regression)', () => {
  it('grows the interval across consecutive Good answers', () => {
    let state = createInitialSrsState('1', new Date('2026-01-01T00:00:00Z'));
    const gaps: number[] = [];
    for (let i = 0; i < 4; i++) {
      const now = new Date(state.dueDate);
      state = gradeItem(state, 3, now);
      gaps.push(new Date(state.dueDate).getTime() - now.getTime());
    }
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    }
    // The fourth interval must be measured in days, not minutes.
    expect(gaps[3]).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
  });

  it('graduates to review on the first Good, while Again stays on the 10m learning step', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const seed = createInitialSrsState('1', start);

    // With a single learning step, one Good answer graduates straight to the
    // stability curve.
    const good = gradeItem(seed, 3, start);
    expect(good.fsrsState).toBe('review');
    expect(new Date(good.dueDate).getTime() - start.getTime()).toBeGreaterThanOrEqual(
      24 * 60 * 60 * 1000,
    );

    // Again keeps the card in learning with the short confirmation step.
    const again = gradeItem(seed, 1, start);
    expect(again.fsrsState).toBe('learning');
    expect(new Date(again.dueDate).getTime() - start.getTime()).toBeLessThanOrEqual(
      15 * 60 * 1000,
    );
  });

  it('preserves the learning-step index through the card round-trip', () => {
    const state = makeNewState({ fsrsState: 'learning', learningSteps: 1, stability: 1, difficulty: 5 });
    const card = toFsrsCard(state, NOW);
    expect(card.learning_steps).toBe(1);
    const restored = fromFsrsCard(card, state);
    expect(restored.learningSteps).toBe(1);
  });

  it('walks apprentice → guru → master → enlightened on repeated Good answers', () => {
    let state = createInitialSrsState('1', new Date('2026-01-01T00:00:00Z'));
    const seen: string[] = [state.srsStageLabel];
    for (let i = 0; i < 30 && !state.isBurned; i++) {
      state = gradeItem(state, 3, new Date(state.dueDate));
      if (seen[seen.length - 1] !== state.srsStageLabel) {
        seen.push(state.srsStageLabel);
      }
    }
    expect(seen.slice(0, 4)).toEqual(['apprentice', 'guru', 'master', 'enlightened']);
  });

  it('Again from review state moves to relearning and reports apprentice', () => {
    const state = makeState({ stability: 10, difficulty: 5, srsStageLabel: 'guru' });
    const result = gradeItem(state, 1, NOW);
    expect(result.fsrsState).toBe('relearning');
    expect(result.srsStageLabel).toBe('apprentice');
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
