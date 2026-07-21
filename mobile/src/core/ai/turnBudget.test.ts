import { computeTurnBudget } from '@/core/ai/turnBudget';

describe('computeTurnBudget (OA4 placeholder constants)', () => {
  it('gives a fresh N5 beginner the smallest budget', () => {
    expect(computeTurnBudget('N5', { studiedItems: 0, totalItems: 100 })).toBe(8);
  });

  it('grows the budget with level', () => {
    const n5 = computeTurnBudget('N5', { studiedItems: 0, totalItems: 100 });
    const n3 = computeTurnBudget('N3', { studiedItems: 0, totalItems: 100 });

    expect(n3).toBeGreaterThan(n5);
  });

  it('grows the budget with completion at the same level', () => {
    const early = computeTurnBudget('N4', { studiedItems: 10, totalItems: 100 });
    const late = computeTurnBudget('N4', { studiedItems: 90, totalItems: 100 });

    expect(late).toBeGreaterThan(early);
  });

  it('treats an empty level as zero completion rather than dividing by zero', () => {
    const budget = computeTurnBudget('N5', { studiedItems: 0, totalItems: 0 });

    expect(Number.isFinite(budget)).toBe(true);
    expect(budget).toBe(8);
  });

  it('clamps nonsensical stats into the documented bounds', () => {
    expect(computeTurnBudget('N5', { studiedItems: -50, totalItems: 100 })).toBeGreaterThanOrEqual(4);
    expect(computeTurnBudget('N1', { studiedItems: 9999, totalItems: 100 })).toBeLessThanOrEqual(30);
  });

  it('is pure — same inputs, same answer', () => {
    const stats = { studiedItems: 42, totalItems: 100 };

    expect(computeTurnBudget('N2', stats)).toBe(computeTurnBudget('N2', stats));
  });
});
