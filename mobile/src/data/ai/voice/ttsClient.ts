import { TextToSpeechModule } from 'react-native-executorch';

import { ensureExecutorchInitialised } from '@/data/ai/voice/executorchRuntime';
import { areVoiceModelsDownloaded } from '@/data/ai/voice/modelDownloadManager';
import { JAPANESE_TTS_MODEL } from '@/data/ai/voice/voiceModels';
import type { Result } from '@/types/result.types';

/**
 * On-device Japanese speech synthesis via Supertonic (FR98, FR100).
 *
 * Returns the waveform rather than playing it — executorch has no audio output.
 * `audioSession.playWaveform` is the speaker.
 *
 * There is no system-voice fallback by design: `expo-speech` on Android goes
 * silent when Japanese voice data is not installed, without raising an error,
 * and that whole class of failure is why Supertonic ships its own model. A
 * synthesis failure surfaces as an error here instead.
 *
 * Loading refuses to call `fromModelName` until the models are already on disk —
 * that API always runs `ResourceFetcher.fetch` for missing remotes, which would
 * otherwise bypass the explicit download + size-disclosure gate (AC5/NFR25).
 */

type LoadedModule = Awaited<ReturnType<typeof TextToSpeechModule.fromModelName>>;

let modulePromise: Promise<LoadedModule> | null = null;
let inFlightSyntheses = 0;

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
        code: 'voice_tts_models_missing',
        message: 'Speech model files are not downloaded',
        userMessage: 'Download the voice models before speaking practice.',
      },
    };
  }

  modulePromise ??= TextToSpeechModule.fromModelName(JAPANESE_TTS_MODEL);
  try {
    return { ok: true, value: await modulePromise };
  } catch (cause) {
    modulePromise = null;
    return {
      ok: false,
      error: {
        code: 'voice_tts_load_failed',
        message: String(cause),
        userMessage: 'The Japanese voice could not be loaded.',
        cause,
      },
    };
  }
}

/** Frees the loaded model. Called when conversation mode closes. */
export function releaseTtsModel(): void {
  if (inFlightSyntheses > 0) {
    return;
  }
  const pending = modulePromise;
  modulePromise = null;
  void pending?.then((module) => module.delete()).catch(() => {});
}

export async function synthesizeJapanese(text: string): Promise<Result<Float32Array>> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: {
        code: 'voice_tts_empty_text',
        message: 'Nothing to speak',
        userMessage: 'There was nothing to read aloud.',
      },
    };
  }

  const loaded = await loadModule();
  if (!loaded.ok) {
    return loaded;
  }

  inFlightSyntheses += 1;
  try {
    const samples = await loaded.value.forward(trimmed);
    if (samples.length === 0) {
      return {
        ok: false,
        error: {
          code: 'voice_tts_failed',
          message: 'Synthesis produced no audio',
          userMessage: 'Could not read that reply aloud.',
        },
      };
    }
    return { ok: true, value: samples };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'voice_tts_failed',
        message: String(cause),
        userMessage: 'Could not read that reply aloud.',
        cause,
      },
    };
  } finally {
    inFlightSyntheses -= 1;
  }
}
