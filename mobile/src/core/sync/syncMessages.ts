import type { SyncErrorCode } from '@/core/sync/sync.types';
import type { AppError } from '@/types/result.types';

const DID_NOT_FINISH = 'Sync did not finish. It runs again the next time.';

const MESSAGES: Record<SyncErrorCode, string> = {
  sync_update_required: 'Update the app to sync',
  sync_bad_file: 'The progress file on the server cannot be read. Your progress on this device is safe.',
  sync_busy: DID_NOT_FINISH,
  sync_local_failed: 'Sync could not save on this device. Nothing was changed.',
  sync_local_changed: DID_NOT_FINISH,
};

export function syncErrorMessage(code: SyncErrorCode): string {
  return MESSAGES[code];
}

export function syncError(code: SyncErrorCode, cause?: unknown): AppError {
  return {
    code,
    message: `Sync failed: ${code}`,
    userMessage: syncErrorMessage(code),
    cause,
  };
}
