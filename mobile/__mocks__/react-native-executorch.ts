/**
 * Stands in for the pinned `react-native-executorch` nightly under Jest.
 *
 * The real package is a native module: it cannot load in node, and its model
 * URLs point at multi-hundred-megabyte files. Only the surface `data/ai/voice/`
 * actually calls is reproduced here — `models`, the two module classes, and the
 * filename helper the download manager uses to check what is on disk.
 *
 * `getFilenameFromUri` mirrors the real implementation exactly, because the
 * download manager's presence check depends on that derivation matching what
 * the fetcher wrote.
 */

type SttModule = {
  transcribe: (waveform: Float32Array, options?: { language?: string }) => Promise<{ text: string }>;
  delete: () => void;
};

type TtsModule = {
  forward: (input: string) => Promise<Float32Array>;
  delete: () => void;
};

const state = {
  transcription: '',
  synthesis: new Float32Array(0) as Float32Array<ArrayBufferLike>,
  sttLoadError: null as Error | null,
  ttsLoadError: null as Error | null,
  transcribeError: null as Error | null,
  synthesizeError: null as Error | null,
  initCount: 0,
  sttLoadCount: 0,
  ttsLoadCount: 0,
  transcribeCalls: [] as { waveform: Float32Array; language?: string }[],
  synthesizeCalls: [] as string[],
};

export function __mockResetExecutorch(): void {
  state.transcription = '';
  state.synthesis = new Float32Array(0);
  state.sttLoadError = null;
  state.ttsLoadError = null;
  state.transcribeError = null;
  state.synthesizeError = null;
  state.initCount = 0;
  state.sttLoadCount = 0;
  state.ttsLoadCount = 0;
  state.transcribeCalls = [];
  state.synthesizeCalls = [];
}

export function __mockSetTranscription(text: string): void {
  state.transcription = text;
}

export function __mockSetSynthesis(samples: Float32Array): void {
  state.synthesis = samples;
}

export function __mockFailSttLoad(error: Error): void {
  state.sttLoadError = error;
}

export function __mockFailTtsLoad(error: Error): void {
  state.ttsLoadError = error;
}

export function __mockFailTranscribe(error: Error): void {
  state.transcribeError = error;
}

export function __mockFailSynthesize(error: Error): void {
  state.synthesizeError = error;
}

export function __mockExecutorchState() {
  return state;
}

export function initExecutorch(_config: unknown): void {
  state.initCount += 1;
}

export const models = {
  speech_to_text: {
    whisper_small: () => ({
      modelName: 'whisper-small' as const,
      isMultilingual: true as const,
      modelSource: 'https://models.test/whisper/whisper_small.pte',
      tokenizerSource: 'https://models.test/whisper/tokenizer.json',
    }),
  },
  text_to_speech: {
    supertonic: {
      f1: () => ({
        model: {
          modelName: 'supertonic' as const,
          unicodeIndexerSource: 'https://models.test/supertonic/indexer.pte',
          durationPredictorSource: 'https://models.test/supertonic/duration.pte',
          textEncoderSource: 'https://models.test/supertonic/encoder.pte',
          vectorEstimatorSource: 'https://models.test/supertonic/vector.pte',
          vocoderSource: 'https://models.test/supertonic/vocoder.pte',
        },
        voiceSource: 'https://models.test/supertonic/voice_f1.bin',
      }),
    },
  },
};

export const SpeechToTextModule = {
  async fromModelName(
    _config: unknown,
    _vad?: unknown,
    onDownloadProgress?: (progress: number) => void,
  ): Promise<SttModule> {
    state.sttLoadCount += 1;
    onDownloadProgress?.(1);
    if (state.sttLoadError) {
      throw state.sttLoadError;
    }
    return {
      async transcribe(waveform, options) {
        state.transcribeCalls.push({ waveform, language: options?.language });
        if (state.transcribeError) {
          throw state.transcribeError;
        }
        return { text: state.transcription };
      },
      delete() {},
    };
  },
};

export const TextToSpeechModule = {
  async fromModelName(
    _config: unknown,
    onDownloadProgress?: (progress: number) => void,
  ): Promise<TtsModule> {
    state.ttsLoadCount += 1;
    onDownloadProgress?.(1);
    if (state.ttsLoadError) {
      throw state.ttsLoadError;
    }
    return {
      async forward(input) {
        state.synthesizeCalls.push(input);
        if (state.synthesizeError) {
          throw state.synthesizeError;
        }
        return state.synthesis;
      },
      delete() {},
    };
  },
};

export const ResourceFetcherUtils = {
  getFilenameFromUri(uri: string): string {
    let cleanUri = uri.replace(/^https?:\/\//, '');
    cleanUri = cleanUri.split('#')?.[0] ?? cleanUri;
    return cleanUri.replace(/[^a-zA-Z0-9._-]/g, '_');
  },
};
