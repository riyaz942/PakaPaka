import { SpeechToTextModule } from 'react-native-executorch';

import { ensureExecutorchInitialised } from '@/data/ai/voice/executorchRuntime';
import { areVoiceModelsDownloaded } from '@/data/ai/voice/modelDownloadManager';
import { JAPANESE_STT_MODEL } from '@/data/ai/voice/voiceModels';
import type { Result } from '@/types/result.types';

/**
 * On-device Japanese transcription (FR99).
 *
 * Every failure is returned, never swallowed: nothing here ever reaches for a
 * cloud endpoint. Cloud STT is a separate, Settings-gated path (UX-DR33), so a
 * model that will not load or a transcription that comes back empty is an error
 * the learner sees, not a quiet handover to the network.
 *
 * Loading refuses to call `fromModelName` until the models are already on disk —
 * that API always runs `ResourceFetcher.fetch` for missing remotes, which would
 * otherwise bypass the explicit download + size-disclosure gate (AC5/NFR25).
 */

type LoadedModule = Awaited<ReturnType<typeof SpeechToTextModule.fromModelName>>;

let modulePromise: Promise<LoadedModule> | null = null;
let inFlightTranscribes = 0;

async function loadModule(): Promise<Result<LoadedModule>> {
  ensureExecutorchInitialised();
  const downloaded = await areVoiceModelsDownloaded();
  if (!downloaded.ok) {
    return downloaded;
  }
  if (!downloaded.value) {
    return {
      ok: false,
      error: {
        code: 'voice_stt_models_missing',
        message: 'Speech model files are not downloaded',
        userMessage: 'Download the voice models before speaking practice.',
      },
    };
  }

  modulePromise ??= SpeechToTextModule.fromModelName(JAPANESE_STT_MODEL);
  try {
    return { ok: true, value: await modulePromise };
  } catch (cause) {
    modulePromise = null;
    return {
      ok: false,
      error: {
        code: 'voice_stt_load_failed',
        message: String(cause),
        userMessage: 'The speech model could not be loaded.',
        cause,
      },
    };
  }
}

/** Frees the loaded model. Called when conversation mode closes. */
export function releaseSttModel(): void {
  if (inFlightTranscribes > 0) {
    return;
  }
  const pending = modulePromise;
  modulePromise = null;
  void pending?.then((module) => module.delete()).catch(() => {});
}

export async function transcribeJapanese(waveform: Float32Array): Promise<Result<string>> {
  const loaded = await loadModule();
  if (!loaded.ok) {
    return loaded;
  }

  inFlightTranscribes += 1;
  try {
    const result = await loaded.value.transcribe(waveform, { language: 'ja' });
    const text = result.text.trim();
    if (text.length === 0) {
      return {
        ok: false,
        error: {
          code: 'voice_stt_empty',
          message: 'Transcription produced no text',
          userMessage: "That didn't catch any speech. Try holding the button and speaking again.",
        },
      };
    }
    return { ok: true, value: text };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'voice_stt_failed',
        message: String(cause),
        userMessage: 'Could not transcribe that recording.',
        cause,
      },
    };
  } finally {
    inFlightTranscribes -= 1;
  }
}
