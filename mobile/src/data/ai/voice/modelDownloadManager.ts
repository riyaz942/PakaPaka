import { ResourceFetcherUtils } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

import { ensureExecutorchInitialised } from '@/data/ai/voice/executorchRuntime';
import { voiceModelSources } from '@/data/ai/voice/voiceModels';
import type { AppError, Result } from '@/types/result.types';

/**
 * Explicit, learner-initiated download of the voice models (AC5, NFR25, UX-DR23).
 *
 * Nothing here runs unless the learner taps the mic and confirms — no cold-start
 * work, no background fetch, no "warm the cache" call.
 *
 * Presence is a filesystem fact, checked every time. The fetcher downloads into
 * the cache directory and only moves the file into its model directory once the
 * transfer completes, so a listing of that directory cannot show a half-written
 * file. That is why there is no "download succeeded" flag anywhere — a flag can
 * drift from the disk, and a stale one pointing at a missing model is exactly
 * the silent failure this feature must not have.
 */

function fileNameOf(source: unknown): string | null {
  return typeof source === 'string' ? ResourceFetcherUtils.getFilenameFromUri(source) : null;
}

function toError(code: string, userMessage: string, cause: unknown): AppError {
  return { code, message: String(cause), userMessage, cause };
}

export async function areVoiceModelsDownloaded(): Promise<Result<boolean>> {
  ensureExecutorchInitialised();
  try {
    const present = new Set(
      (await ExpoResourceFetcher.listDownloadedFiles()).map((path) =>
        path.slice(path.lastIndexOf('/') + 1),
      ),
    );
    const required = voiceModelSources().map(fileNameOf);
    return {
      ok: true,
      value: required.every((name) => name !== null && present.has(name)),
    };
  } catch (cause) {
    return {
      ok: false,
      error: toError(
        'voice_model_check_failed',
        'Could not check whether the voice models are downloaded.',
        cause,
      ),
    };
  }
}

/**
 * The real combined size of the model files, read from the server.
 *
 * A failure is returned rather than substituted with an estimate: the download
 * prompt has to disclose a true size, and a device that cannot reach the model
 * host cannot download them anyway.
 */
export async function getVoiceModelDownloadBytes(): Promise<Result<number>> {
  ensureExecutorchInitialised();
  try {
    const bytes = await ExpoResourceFetcher.getFilesTotalSize(...voiceModelSources());
    return { ok: true, value: bytes };
  } catch (cause) {
    return {
      ok: false,
      error: toError(
        'voice_model_size_unavailable',
        'Could not reach the voice model download. Check your connection and try again.',
        cause,
      ),
    };
  }
}

export async function downloadVoiceModels(
  onProgress?: (progress: number) => void,
): Promise<Result<void>> {
  ensureExecutorchInitialised();
  try {
    await ExpoResourceFetcher.fetch(
      (progress) => onProgress?.(progress),
      ...voiceModelSources(),
    );
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: toError(
        'voice_model_download_failed',
        'The voice model download did not finish. You can try again.',
        cause,
      ),
    };
  }
}
