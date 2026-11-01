/**
 * Stands in for the pinned `react-native-executorch` under Jest.
 *
 * The real package is a native module: it cannot load in node, and its model
 * URLs point at multi-hundred-megabyte files. Only the surface `data/ai/voice/`
 * actually calls is reproduced here — `models`, `download`, and the two task
 * factories.
 *
 * `download` keeps its files in the `react-native-blob-util` mock, which is
 * where the download manager checks for them.
 */

import { __mockRunDownload } from './react-native-blob-util';

type SttTask = {
  transcribe: (waveform: Float32Array, options: { language: string }) => Promise<string>;
  dispose: () => void;
};

type TtsTask = {
  synthesize: (
    text: string,
    options: { voiceStyle: string; lang?: string },
  ) => AsyncGenerator<{ audio: Float32Array }>;
  dispose: () => void;
};

const state = {
  transcription: '',
  synthesis: new Float32Array(0) as Float32Array<ArrayBufferLike>,
  sttLoadError: null as Error | null,
  ttsLoadError: null as Error | null,
  transcribeError: null as Error | null,
  synthesizeError: null as Error | null,
  sttLoadCount: 0,
  ttsLoadCount: 0,
  transcribeCalls: [] as { waveform: Float32Array; language: string }[],
  synthesizeCalls: [] as string[],
  synthesizeOptions: [] as { voiceStyle: string; lang?: string }[],
};

export function __mockResetExecutorch(): void {
  state.transcription = '';
  state.synthesis = new Float32Array(0);
  state.sttLoadError = null;
  state.ttsLoadError = null;
  state.transcribeError = null;
  state.synthesizeError = null;
  state.sttLoadCount = 0;
  state.ttsLoadCount = 0;
  state.transcribeCalls = [];
  state.synthesizeCalls = [];
  state.synthesizeOptions = [];
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

const whisperSmall = {
  modelPath: 'https://models.test/whisper/whisper_small.pte',
  tokenizerPath: 'https://models.test/whisper/tokenizer.json',
  supportedLanguages: ['ja'],
  vadModel: {
    modelPath: 'https://models.test/fsmn-vad/fsmn_vad.pte',
    defaultOptions: {},
  },
};

const supertonic = {
  name: 'supertonic' as const,
  modelPaths: {
    durationPredictor: 'https://models.test/supertonic/duration.pte',
    vectorEstimator: 'https://models.test/supertonic/vector.pte',
    textEncoder: 'https://models.test/supertonic/encoder.pte',
    vocoder: 'https://models.test/supertonic/vocoder.pte',
  },
  unicodeIndexerPath: 'https://models.test/supertonic/unicode_indexer.json',
  voiceStyles: {
    F1: 'https://models.test/supertonic/voice_styles/F1.json',
    M1: 'https://models.test/supertonic/voice_styles/M1.json',
  },
};

export const models = {
  speechToText: {
    WHISPER: { SMALL: { XNNPACK_FP32: whisperSmall, DEFAULT: whisperSmall } },
  },
  textToSpeech: {
    SUPERTONIC: { XNNPACK_FP32: supertonic, DEFAULT: supertonic },
  },
};

function collectUrls(node: unknown, into: Set<string>): Set<string> {
  if (typeof node === 'string') {
    if (/^https?:\/\//.test(node)) {
      into.add(node);
    }
  } else if (Array.isArray(node)) {
    node.forEach((child) => collectUrls(child, into));
  } else if (node !== null && typeof node === 'object') {
    Object.values(node).forEach((child) => collectUrls(child, into));
  }
  return into;
}

function substitute<T>(node: T, resolved: Map<string, string>): T {
  if (typeof node === 'string') {
    return (resolved.get(node) ?? node) as T;
  }
  if (Array.isArray(node)) {
    return node.map((child) => substitute(child, resolved)) as T;
  }
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, child]) => [key, substitute(child, resolved)]),
    ) as T;
  }
  return node;
}

export async function download<T>(
  source: T,
  options: {
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const resolved = await __mockRunDownload(
    [...collectUrls(source, new Set())],
    options.onProgress,
    options.signal,
  );
  return substitute(source, resolved);
}

export async function createWhisperSpeechToText(_config: unknown): Promise<SttTask> {
  state.sttLoadCount += 1;
  if (state.sttLoadError) {
    throw state.sttLoadError;
  }
  return {
    async transcribe(waveform, options) {
      state.transcribeCalls.push({ waveform, language: options.language });
      if (state.transcribeError) {
        throw state.transcribeError;
      }
      return state.transcription;
    },
    dispose() {},
  };
}

export async function createSupertonicTextToSpeech(_config: unknown): Promise<TtsTask> {
  state.ttsLoadCount += 1;
  if (state.ttsLoadError) {
    throw state.ttsLoadError;
  }
  return {
    async *synthesize(text, options) {
      state.synthesizeCalls.push(text);
      state.synthesizeOptions.push(options);
      if (state.synthesizeError) {
        throw state.synthesizeError;
      }
      if (state.synthesis.length > 0) {
        yield { audio: state.synthesis };
      }
    },
    dispose() {},
  };
}
