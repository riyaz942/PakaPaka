import { AudioContext, AudioManager, AudioRecorder } from 'react-native-audio-api';

import { STT_SAMPLE_RATE, TTS_SAMPLE_RATE } from '@/data/ai/voice/voiceModels';
import type { Result } from '@/types/result.types';

/**
 * The microphone and the speaker.
 *
 * Executorch deals only in sample arrays — it neither records nor plays. This
 * module is the pipe on both ends: it captures what Whisper transcribes, and it
 * plays what Supertonic synthesizes. It adds no voice and no processing of its
 * own beyond rate conversion.
 */

/** Buffer size the recorder callback aims for — ~64 ms at 16 kHz. */
const RECORD_BUFFER_LENGTH = 1024;

let recorder: AudioRecorder | null = null;
let capturedChunks: Float32Array[] = [];
let capturedSampleRate = STT_SAMPLE_RATE;
let playbackContext: AudioContext | null = null;

/**
 * Linear resample to Whisper's 16 kHz.
 *
 * The recorder documents that hardware may ignore the requested rate, and
 * Whisper silently misreads audio at the wrong rate rather than rejecting it —
 * so the delivered rate is always honoured rather than assumed.
 */
export function resampleTo16kHz(samples: Float32Array, sourceSampleRate: number): Float32Array {
  if (sourceSampleRate === STT_SAMPLE_RATE || samples.length === 0) {
    return samples;
  }

  const ratio = sourceSampleRate / STT_SAMPLE_RATE;
  const targetLength = Math.floor(samples.length / ratio);
  const resampled = new Float32Array(targetLength);

  for (let index = 0; index < targetLength; index += 1) {
    const position = index * ratio;
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, samples.length - 1);
    const weight = position - lower;
    resampled[index] = samples[lower] * (1 - weight) + samples[upper] * weight;
  }

  return resampled;
}

export async function ensureMicrophonePermission(): Promise<Result<void>> {
  try {
    let status = await AudioManager.checkRecordingPermissions();
    if (status !== 'Granted') {
      status = await AudioManager.requestRecordingPermissions();
    }
    if (status !== 'Granted') {
      return {
        ok: false,
        error: {
          code: 'voice_microphone_denied',
          message: `Microphone permission ${status}`,
          userMessage:
            'Speaking practice needs microphone access. You can grant it in your device settings.',
        },
      };
    }
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'voice_microphone_unavailable',
        message: String(cause),
        userMessage: 'Could not access the microphone.',
        cause,
      },
    };
  }
}

export async function startRecording(): Promise<Result<void>> {
  capturedChunks = [];
  capturedSampleRate = STT_SAMPLE_RATE;

  try {
    recorder ??= new AudioRecorder();
    recorder.onAudioReady(
      { sampleRate: STT_SAMPLE_RATE, bufferLength: RECORD_BUFFER_LENGTH, channelCount: 1 },
      (event) => {
        capturedSampleRate = event.buffer.sampleRate;
        capturedChunks.push(Float32Array.from(event.buffer.getChannelData(0)));
      },
    );
    await recorder.start();
    return { ok: true, value: undefined };
  } catch (cause) {
    recorder?.clearOnAudioReady();
    return {
      ok: false,
      error: {
        code: 'voice_recording_failed',
        message: String(cause),
        userMessage: 'Could not start recording.',
        cause,
      },
    };
  }
}

/** Stops recording and returns everything captured as one 16 kHz mono waveform. */
export async function stopRecording(): Promise<Result<Float32Array>> {
  try {
    await recorder?.stop();
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'voice_recording_failed',
        message: String(cause),
        userMessage: 'Could not finish the recording.',
        cause,
      },
    };
  } finally {
    recorder?.clearOnAudioReady();
  }

  const chunks = capturedChunks;
  const sampleRate = capturedSampleRate;
  capturedChunks = [];

  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  if (totalLength === 0) {
    return {
      ok: false,
      error: {
        code: 'voice_recording_empty',
        message: 'No audio captured',
        userMessage: "That didn't record any audio. Hold the button while you speak.",
      },
    };
  }

  const combined = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return { ok: true, value: resampleTo16kHz(combined, sampleRate) };
}

export async function playWaveform(
  samples: Float32Array,
  sampleRate: number = TTS_SAMPLE_RATE,
): Promise<Result<void>> {
  if (samples.length === 0) {
    return {
      ok: false,
      error: {
        code: 'voice_playback_empty',
        message: 'Nothing to play',
        userMessage: 'There was no audio to play.',
      },
    };
  }

  try {
    playbackContext ??= new AudioContext({ sampleRate });
    const buffer = playbackContext.createBuffer(1, samples.length, sampleRate);
    // `copyToChannel` is the sanctioned write path — `getChannelData` crosses
    // the JSI boundary and is not guaranteed to hand back the live array.
    const channel = new Float32Array(samples.length);
    channel.set(samples);
    buffer.copyToChannel(channel, 0);
    const source = playbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(playbackContext.destination);
    source.start();
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'voice_playback_failed',
        message: String(cause),
        userMessage: 'Could not play the reply aloud.',
        cause,
      },
    };
  }
}

/** Tears down the shared recorder and audio context when conversation mode closes. */
export function releaseAudioSession(): void {
  recorder?.clearOnAudioReady();
  recorder = null;
  capturedChunks = [];
  void playbackContext?.close().catch(() => {});
  playbackContext = null;
}
