import { createSeededRng } from '@/utils/seededRng';

import { allocateTypeSlots, type MixBucket } from './lessonMix';

const early: MixBucket[] = [
  { type: 'radical', available: 50, remaining: 118 }, // weight 472
  { type: 'kanji', available: 50, remaining: 150 }, // weight 300
  { type: 'vocabulary', available: 50, remaining: 718 }, // weight 718 → quotas 1.58 / 1.01 / 2.41
];

it('gives the leftover slot by the fractional parts', () => {
  expect(allocateTypeSlots(5, early, () => 0)).toEqual({ radical: 2, kanji: 1, vocabulary: 2 });
  expect(allocateTypeSlots(5, early, () => 0.99)).toEqual({ radical: 1, kanji: 1, vocabulary: 3 });
});

it('never moves a type more than one from its floor', () => {
  for (let s = 0; s < 1000; s++) {
    const a = allocateTypeSlots(5, early, createSeededRng(String(s)));
    expect(a.radical).toBeGreaterThanOrEqual(1);
    expect(a.radical).toBeLessThanOrEqual(2);
    expect(a.kanji).toBeGreaterThanOrEqual(1);
    expect(a.kanji).toBeLessThanOrEqual(2);
    expect(a.vocabulary).toBeGreaterThanOrEqual(2);
    expect(a.vocabulary).toBeLessThanOrEqual(3);
  }
});

it('caps a type at what is available and gives the rest to others', () => {
  const a = allocateTypeSlots(5, [{ ...early[0], available: 1 }, early[1], early[2]], () => 0.5);
  expect(a.radical).toBe(1);
  expect(a.kanji + a.vocabulary).toBe(4);
});

it('fills at most what is available in total', () =>
  expect(
    Object.values(allocateTypeSlots(5, [{ type: 'radical', available: 2, remaining: 2 }], () => 0)),
  ).toEqual([2, 0, 0]));

it('returns zeros for no buckets', () =>
  expect(allocateTypeSlots(5, [], () => 0)).toEqual({ radical: 0, kanji: 0, vocabulary: 0 }));
