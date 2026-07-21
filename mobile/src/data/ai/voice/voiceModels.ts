import { models } from 'react-native-executorch';
import type {
  ResourceSource,
  TextToSpeechModelConfig,
  TextToSpeechModelSources,
} from 'react-native-executorch';

/**
 * The pinned Japanese voice models (FR100, NFR30).
 *
 * `whisper-small` rather than tiny/base: tiny's Japanese word error rate is too
 * poor for learner speech, and the download size is the accepted cost of that
 * choice, not an oversight.
 *
 * Supertonic is the only built-in TTS with a Japanese language token — Kokoro
 * has no `ja` phonemizer, which is why this story pins an executorch nightly
 * rather than a release. The registry accessors resolve the right backend per
 * platform (MLX on iOS, XNNPACK on Android) on their own.
 */

/** Whisper's fixed input rate. Anything the microphone gives us is resampled to it. */
export const STT_SAMPLE_RATE = 16000;

/** Supertonic's fixed output rate (`supertonic/Constants.h`: `kSamplingRate`). */
export const TTS_SAMPLE_RATE = 44100;

export const JAPANESE_STT_MODEL = models.speech_to_text.whisper_small();

export const JAPANESE_TTS_MODEL: TextToSpeechModelConfig = {
  ...models.text_to_speech.supertonic.f1(),
  lang: 'ja',
};

function ttsModelSources(model: TextToSpeechModelSources): ResourceSource[] {
  if (model.modelName === 'kokoro') {
    return [model.durationPredictorSource, model.synthesizerSource];
  }
  return [
    model.unicodeIndexerSource,
    model.durationPredictorSource,
    model.textEncoderSource,
    model.vectorEstimatorSource,
    model.vocoderSource,
  ];
}

/**
 * Every file that must be on disk before voice works. The download manager uses
 * this both to size the download and to decide whether it already happened.
 */
export function voiceModelSources(): ResourceSource[] {
  return [
    JAPANESE_STT_MODEL.modelSource,
    JAPANESE_STT_MODEL.tokenizerSource,
    ...ttsModelSources(JAPANESE_TTS_MODEL.model),
    JAPANESE_TTS_MODEL.voiceSource,
  ];
}
