import { Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { download } from 'react-native-executorch';

import { voiceModelSources } from '@/data/ai/voice/voiceModels';
import type { AppError, Result } from '@/types/result.types';

/**
 * Explicit, learner-initiated download of the voice models (AC5, NFR25, UX-DR23).
 *
 * Nothing here runs unless the learner taps the mic and confirms — no cold-start
 * work, no background fetch, no "warm the cache" call.
 *
 * Presence is a filesystem fact, checked every time. The fetcher streams into a
 * `.partial` file and only writes the cache path once the transfer completes,
 * so a file at that path is never half-written. That is why there is no
 * "download succeeded" flag anywhere — a flag can drift from the disk, and a
 * stale one pointing at a missing model is exactly the silent failure this
 * feature must not have.
 */

/**
 * Where the fetcher stores a URL. Mirrors `cachePathFor` in
 * `react-native-executorch/src/fetcher/fetcher.ts` (0.10.7), which the package
 * does not export: djb2 of the query-less URL, then the basename.
 */
const MODEL_DIRECTORY = `${
  Platform.OS === 'android'
    ? RNBlobUtil.fs.dirs.SDCardDir || RNBlobUtil.fs.dirs.DocumentDir
    : RNBlobUtil.fs.dirs.DocumentDir
}/react-native-executorch`;

function cachePathFor(url: string): string {
  const urlWithoutQuery = url.split('?')[0] ?? url;
  let hash = 5381;
  for (let i = 0; i < urlWithoutQuery.length; i++) {
    hash = (((hash << 5) + hash) ^ urlWithoutQuery.charCodeAt(i)) >>> 0;
  }
  const basename = urlWithoutQuery.split('/').pop() || 'model';
  return `${MODEL_DIRECTORY}/${hash}_${basename}`;
}

function toError(code: string, userMessage: string, cause: unknown): AppError {
  return { code, message: String(cause), userMessage, cause };
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}

let activeDownload: AbortController | null = null;

export async function areVoiceModelsDownloaded(): Promise<Result<boolean>> {
  try {
    for (const source of voiceModelSources()) {
      if (!(await RNBlobUtil.fs.exists(cachePathFor(source)))) {
        return { ok: true, value: false };
      }
    }
    return { ok: true, value: true };
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

const UNREACHABLE_MESSAGE =
  'Could not reach the voice model download. Check your connection and try again.';

// The server answered, so the learner's connection is fine — telling them to
// check it would send them after the wrong problem.
const UNAVAILABLE_MESSAGE =
  'The voice model download is not available from the server at the moment. Your connection is not the problem. Try again later.';

/**
 * The real combined size of the model files, read from the server.
 *
 * A failure is returned rather than substituted with an estimate: the download
 * prompt has to disclose a true size, and a device that cannot reach the model
 * host cannot download them anyway. Each remote source is probed individually
 * so a partial HEAD failure cannot under-report as a successful total.
 */
export async function getVoiceModelDownloadBytes(): Promise<Result<number>> {
  let total = 0;
  for (const source of voiceModelSources()) {
    let status: number;
    let headers: Record<string, string>;
    try {
      const info = (await RNBlobUtil.fetch('HEAD', source)).info();
      status = info.status;
      headers = info.headers;
    } catch (cause) {
      return {
        ok: false,
        error: toError('voice_model_size_unavailable', UNREACHABLE_MESSAGE, cause),
      };
    }
    if (status < 200 || status >= 300) {
      return {
        ok: false,
        error: toError(
          'voice_model_unavailable',
          UNAVAILABLE_MESSAGE,
          `HTTP ${status} for ${source}`,
        ),
      };
    }
    // `x-linked-size` first: Hugging Face serves model files from a CDN by
    // redirect, and only this header describes the file itself on every hop.
    const bytes = Number(
      headerValue(headers, 'x-linked-size') || headerValue(headers, 'content-length'),
    );
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return {
        ok: false,
        error: toError(
          'voice_model_size_unavailable',
          UNAVAILABLE_MESSAGE,
          `Size probe returned ${bytes} for ${source}`,
        ),
      };
    }
    total += bytes;
  }
  return { ok: true, value: total };
}

export async function downloadVoiceModels(
  onProgress?: (progress: number) => void,
): Promise<Result<void>> {
  const controller = new AbortController();
  activeDownload = controller;
  try {
    await download(voiceModelSources(), {
      onProgress,
      signal: controller.signal,
    });
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
  } finally {
    if (activeDownload === controller) {
      activeDownload = null;
    }
  }
}

/**
 * Aborts an in-flight model download. No-op success when nothing is active.
 * The bytes fetched so far are kept, so the next download resumes.
 */
export async function cancelVoiceModelDownload(): Promise<Result<void>> {
  activeDownload?.abort();
  activeDownload = null;
  return { ok: true, value: undefined };
}
