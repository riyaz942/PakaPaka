import { createSupertonicTextToSpeech, download } from 'react-native-executorch';
import type { SupertonicTextToSpeech } from 'react-native-executorch';

import { areVoiceModelsDownloaded } from '@/data/ai/voice/modelDownloadManager';
import { JAPANESE_TTS_MODEL, TTS_VOICE } from '@/data/ai/voice/voiceModels';
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
 * Loading refuses to call `download` until the models are already on disk —
 * it fetches any missing remote, which would otherwise bypass the explicit
 * download + size-disclosure gate (AC5/NFR25). With every file cached it only
 * maps the URLs to local paths.
 */

type LoadedModule = SupertonicTextToSpeech<typeof TTS_VOICE>;

let modulePromise: Promise<LoadedModule> | null = null;
let inFlightSyntheses = 0;

async function loadModule(): Promise<Result<LoadedModule>> {
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

  modulePromise ??= download(JAPANESE_TTS_MODEL).then((local) =>
    createSupertonicTextToSpeech(local),
  );
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
  void pending?.then((module) => module.dispose()).catch(() => {});
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
    const chunks: Float32Array[] = [];
    for await (const chunk of loaded.value.synthesize(trimmed, {
      voiceStyle: TTS_VOICE,
      lang: 'ja',
    })) {
      chunks.push(chunk.audio);
    }
    const samples = concatenate(chunks);
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

/** Supertonic yields one waveform per text chunk; playback wants a single buffer. */
function concatenate(chunks: Float32Array[]): Float32Array {
  const samples = new Float32Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  return samples;
}
