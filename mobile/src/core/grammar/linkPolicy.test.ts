import { isWordLinked } from './linkPolicy';

describe('isWordLinked (D12)', () => {
  it.each([
    ['read', false, true, true],
    ['read', false, false, true],
    ['read', true, true, true],
    ['build', false, true, false],
    ['build', false, false, true],
    ['build', true, true, true],
    ['build', true, false, true],
  ] as const)('%s card, answered=%s, started=%s → %s', (card, answered, wordStarted, expected) => {
    expect(isWordLinked({ card, answered, wordStarted })).toBe(expected);
  });
});
