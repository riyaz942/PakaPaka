import { readUpdatesRuntimeMetadata } from '@/lib/safe-updates-metadata';

describe('readUpdatesRuntimeMetadata', () => {
  it('does not throw and returns a stable shape', () => {
    const result = readUpdatesRuntimeMetadata();
    expect(result).toHaveProperty('runtimeVersion');
    expect(result).toHaveProperty('isEmbeddedLaunch');
  });
});
