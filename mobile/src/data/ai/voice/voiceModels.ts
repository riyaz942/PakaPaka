import { Platform } from 'react-native';
import { models } from 'react-native-executorch';
import type { SupertonicTtsModel, WhisperSttModel } from 'react-native-executorch';

/**
 * The pinned Japanese voice models (FR100, NFR30).
 *
 * `whisper-small` rather than tiny/base: tiny's Japanese word error rate is too
 * poor for learner speech, and the download size is the accepted cost of that
 * choice, not an oversight.
 *
 * Supertonic is the only built-in TTS with a Japanese language token — Kokoro
 * has no `ja` phonemizer. The registry's `DEFAULT` would pick the Vulkan export
 * on Android because the Vulkan backend is linked by default; Android is pinned
 * to XNNPACK (CPU) so the GPU driver is never in the path. iOS keeps the
 * registry default (Core ML Whisper, MLX Supertonic).
 */

/** Whisper's fixed input rate. Anything the microphone gives us is resampled to it. */
export const STT_SAMPLE_RATE = 16000;

/** Supertonic's fixed output rate (`SUPERTONIC_SAMPLE_RATE`). */
export const TTS_SAMPLE_RATE = 44100;

/** The one Supertonic voice the app speaks with. */
export const TTS_VOICE = 'F1';

const isAndroid = Platform.OS === 'android';

export const JAPANESE_STT_MODEL: WhisperSttModel = isAndroid
  ? models.speechToText.WHISPER.SMALL.XNNPACK_FP32
  : models.speechToText.WHISPER.SMALL.DEFAULT;

const supertonic = isAndroid
  ? models.textToSpeech.SUPERTONIC.XNNPACK_FP32
  : models.textToSpeech.SUPERTONIC.DEFAULT;

/** Only the one voice style, so the download does not fetch all ten. */
export const JAPANESE_TTS_MODEL: SupertonicTtsModel<typeof TTS_VOICE> = {
  ...supertonic,
  voiceStyles: { [TTS_VOICE]: supertonic.voiceStyles[TTS_VOICE] },
};

/**
 * Every file that must be on disk before voice works. The download manager uses
 * this both to size the download and to decide whether it already happened.
 */
export function voiceModelSources(): string[] {
  return [
    JAPANESE_STT_MODEL.modelPath,
    JAPANESE_STT_MODEL.tokenizerPath,
    JAPANESE_STT_MODEL.vadModel.modelPath,
    ...Object.values(JAPANESE_TTS_MODEL.modelPaths),
    JAPANESE_TTS_MODEL.unicodeIndexerPath,
    ...Object.values(JAPANESE_TTS_MODEL.voiceStyles),
  ];
}
