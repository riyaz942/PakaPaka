import { dropPassedReadOnce } from './readOnce';

const primer = { id: 'primer', sortOrder: 4 };
const masu = { id: 'masu', sortOrder: 5 };
const wa = { id: 'wa', sortOrder: 1 };

describe('dropPassedReadOnce', () => {
  const readOnce = new Set(['primer']);

  it('keeps the primer while nothing after it is started', () => {
    expect(dropPassedReadOnce([wa, primer, masu], readOnce, new Set(['wa']))).toEqual([
      wa,
      primer,
      masu,
    ]);
  });

  it('drops the primer once an item after it is started or known', () => {
    expect(dropPassedReadOnce([wa, primer, masu], readOnce, new Set(['wa', 'masu']))).toEqual([
      wa,
      masu,
    ]);
  });

  it('keeps the primer when only items before it are started', () => {
    expect(dropPassedReadOnce([wa, primer, masu], readOnce, new Set(['wa']))).toContain(primer);
  });

  it('never drops an item that is not read-once', () => {
    expect(dropPassedReadOnce([wa, primer, masu], new Set(), new Set(['masu']))).toEqual([
      wa,
      primer,
      masu,
    ]);
  });
});
