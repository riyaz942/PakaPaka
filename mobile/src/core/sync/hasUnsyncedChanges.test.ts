import { hasUnsyncedChanges } from '@/core/sync/hasUnsyncedChanges';
import { carriedKeysOf } from '@/core/sync/mergeSyncData';
import type { KnownContent } from '@/core/sync/sync.types';
import { emptySyncData, fullSampleData } from '@/core/sync/syncSamples.testutil';

const knowsAll: KnownContent = { hasItem: () => true, hasPassageQuestion: () => true };

function baseOf(data = fullSampleData()) {
  return { revision: 3, data, pendingReplace: false, carried: {} };
}

describe('hasUnsyncedChanges', () => {
  it('no base and empty progress: nothing unsynced', () => {
    expect(hasUnsyncedChanges(emptySyncData(), null, knowsAll)).toBe(false);
  });

  it('no base and progress: unsynced', () => {
    expect(hasUnsyncedChanges(fullSampleData(), null, knowsAll)).toBe(true);
  });

  it('pending replace: unsynced', () => {
    const base = { ...baseOf(), pendingReplace: true };
    expect(hasUnsyncedChanges(fullSampleData(), base, knowsAll)).toBe(true);
  });

  it('local equals the base: nothing unsynced', () => {
    expect(hasUnsyncedChanges(fullSampleData(), baseOf(), knowsAll)).toBe(false);
  });

  it('a changed row: unsynced', () => {
    const local = fullSampleData();
    local.srsStates = [{ ...local.srsStates[0], reps: 4 }];
    expect(hasUnsyncedChanges(local, baseOf(), knowsAll)).toBe(true);
  });

  it('a carried row that local lacks: nothing unsynced', () => {
    const local = { ...fullSampleData(), srsStates: [] };
    const base = { ...baseOf(), carried: carriedKeysOf(fullSampleData(), local, knowsAll) };
    expect(base.carried.srsStates).toHaveLength(1);
    expect(hasUnsyncedChanges(local, base, knowsAll)).toBe(false);
  });
});
