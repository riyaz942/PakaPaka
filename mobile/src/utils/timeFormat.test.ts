import { formatMinutes } from './timeFormat';

describe('formatMinutes', () => {
  it('floors elapsed ms to whole minutes with minimum of 1', () => {
    expect(formatMinutes(0)).toBe(1);
    expect(formatMinutes(30_000)).toBe(1);
    expect(formatMinutes(60_000)).toBe(1);
    expect(formatMinutes(119_999)).toBe(1);
    expect(formatMinutes(120_000)).toBe(2);
  });
});
