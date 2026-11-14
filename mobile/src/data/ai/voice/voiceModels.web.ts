/**
 * Web build of `voiceModels.ts`. `react-native-executorch` is stubbed out on web
 * (see `metro.config.js`), so the native module's top-level `models.*` calls would
 * crash any route that imports it. Every voice surface is hidden behind
 * `supportsVoice()`; nothing on web should ask for a model, and if something does it
 * fails loudly rather than pretending voice works.
 */

/** Whisper's fixed input rate. Kept equal to the native value by a test. */
export const STT_SAMPLE_RATE = 16000;

/** Supertonic's fixed output rate. Kept equal to the native value by a test. */
export const TTS_SAMPLE_RATE = 44100;

function unavailable(): never {
  throw new Error('Voice models are not available on web');
}

export const JAPANESE_STT_MODEL = undefined as never;

export const JAPANESE_TTS_MODEL = undefined as never;

export function voiceModelSources(): never {
  return unavailable();
}
