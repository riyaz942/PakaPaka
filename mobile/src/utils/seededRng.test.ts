import { createSeededRng } from './seededRng';

it('repeats for the same seed', () => {
  const a = createSeededRng('2026-10-24:0');
  const b = createSeededRng('2026-10-24:0');
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

it('differs for another seed', () =>
  expect(createSeededRng('2026-10-24:0')()).not.toBe(createSeededRng('2026-10-24:5')()));

it('stays in [0, 1)', () => {
  const r = createSeededRng('x');
  for (let i = 0; i < 1000; i++) {
    const v = r();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});
