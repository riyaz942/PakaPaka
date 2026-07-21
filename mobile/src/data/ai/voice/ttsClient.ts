import { TextToSpeechModule } from 'react-native-executorch';

import { ensureExecutorchInitialised } from '@/data/ai/voice/executorchRuntime';
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
 */

type LoadedModule = Awaited<ReturnType<typeof TextToSpeechModule.fromModelName>>;

let modulePromise: Promise<LoadedModule> | null = null;

function loadModule(): Promise<LoadedModule> {
  ensureExecutorchInitialised();
  modulePromise ??= TextToSpeechModule.fromModelName(JAPANESE_TTS_MODEL);
  return modulePromise;
}

/** Frees the loaded model. Called when conversation mode closes. */
export function releaseTtsModel(): void {
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

  let module: LoadedModule;
  try {
    module = await loadModule();
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

  try {
    return { ok: true, value: await module.forward(trimmed) };
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
  }
}
