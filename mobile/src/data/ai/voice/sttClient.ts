import { SpeechToTextModule } from 'react-native-executorch';

import { ensureExecutorchInitialised } from '@/data/ai/voice/executorchRuntime';
import { JAPANESE_STT_MODEL } from '@/data/ai/voice/voiceModels';
import type { Result } from '@/types/result.types';

/**
 * On-device Japanese transcription (FR99).
 *
 * Every failure is returned, never swallowed: nothing here ever reaches for a
 * cloud endpoint. Cloud STT is a separate, Settings-gated path (UX-DR33), so a
 * model that will not load or a transcription that comes back empty is an error
 * the learner sees, not a quiet handover to the network.
 */

type LoadedModule = Awaited<ReturnType<typeof SpeechToTextModule.fromModelName>>;

let modulePromise: Promise<LoadedModule> | null = null;

function loadModule(): Promise<LoadedModule> {
  ensureExecutorchInitialised();
  modulePromise ??= SpeechToTextModule.fromModelName(JAPANESE_STT_MODEL);
  return modulePromise;
}

/** Frees the loaded model. Called when conversation mode closes. */
export function releaseSttModel(): void {
  const pending = modulePromise;
  modulePromise = null;
  void pending?.then((module) => module.delete()).catch(() => {});
}

export async function transcribeJapanese(waveform: Float32Array): Promise<Result<string>> {
  let module: LoadedModule;
  try {
    module = await loadModule();
  } catch (cause) {
    // A failed load must not poison every later attempt.
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

  try {
    const result = await module.transcribe(waveform, { language: 'ja' });
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
  }
}
