import { syncError, syncErrorMessage } from './syncMessages';
import type { SyncErrorCode } from './sync.types';

const DID_NOT_FINISH = 'Sync did not finish. It runs again the next time.';

describe('syncErrorMessage', () => {
  it.each<[SyncErrorCode, string]>([
    ['sync_update_required', 'Update the app to sync'],
    ['sync_bad_file', 'The progress file on the server cannot be read. Your progress on this device is safe.'],
    ['sync_busy', DID_NOT_FINISH],
    ['sync_local_failed', 'Sync could not save on this device. Nothing was changed.'],
    ['sync_local_changed', DID_NOT_FINISH],
  ])('%s', (code, copy) => {
    expect(syncErrorMessage(code)).toBe(copy);
  });
});

describe('syncError', () => {
  it('builds an AppError with the code, the user copy and the cause', () => {
    const cause = new Error('boom');
    const error = syncError('sync_bad_file', cause);
    expect(error.code).toBe('sync_bad_file');
    expect(error.userMessage).toBe(syncErrorMessage('sync_bad_file'));
    expect(error.message).toContain('sync_bad_file');
    expect(error.cause).toBe(cause);
  });
});
