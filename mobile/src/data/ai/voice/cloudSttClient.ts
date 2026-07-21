import { fetch } from 'expo/fetch';

import { isAllowedByokRequestUrl } from '@/data/ai/byokCredential.types';
import { encodeWav16BitPcm } from '@/data/ai/voice/wav';
import { STT_SAMPLE_RATE } from '@/data/ai/voice/voiceModels';
import type { Result } from '@/types/result.types';

/**
 * Cloud transcription through the learner's own OpenAI-compatible key (FR99).
 *
 * Reached only when the Settings toggle is on — never as a fallback for the
 * on-device model. Of the two BYOK adapters only this one has an audio
 * transcription endpoint at all; Anthropic has none, which is why there is no
 * adapter abstraction here.
 */

/** The transcription model id OpenAI-compatible endpoints universally expose. */
export const DEFAULT_CLOUD_STT_MODEL = 'whisper-1';

/** Cap hung cloud transcriptions so the PTT UI cannot wait forever. */
const CLOUD_STT_TIMEOUT_MS = 30_000;

type CloudSttOptions = {
  apiKey: string;
  baseUrl: string;
  model?: string;
};

export async function transcribeJapaneseViaCloud(
  waveform: Float32Array,
  { apiKey, baseUrl, model = DEFAULT_CLOUD_STT_MODEL }: CloudSttOptions,
): Promise<Result<string>> {
  const url = `${baseUrl.replace(/\/+$/, '')}/audio/transcriptions`;
  // The learner's key and their voice both leave the device here, so the same
  // HTTPS rule the chat client enforces applies (NFR24).
  if (!isAllowedByokRequestUrl(url)) {
    return {
      ok: false,
      error: {
        code: 'voice_cloud_stt_insecure_url',
        message: `Refusing to send audio to ${url}`,
        userMessage: 'Cloud transcription needs an HTTPS endpoint.',
      },
    };
  }

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    const form = new FormData();
    form.append(
      'file',
      new Blob([encodeWav16BitPcm(waveform, STT_SAMPLE_RATE)], {
        type: 'audio/wav',
      }),
      'speech.wav',
    );
    form.append('model', model);
    form.append('language', 'ja');

    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(CLOUD_STT_TIMEOUT_MS),
    });
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'voice_cloud_stt_unreachable',
        message: String(cause),
        userMessage: 'Could not reach the transcription service.',
        cause,
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: 'voice_cloud_stt_rejected',
        message: `Transcription request failed with ${response.status}`,
        userMessage: 'The transcription service rejected that request.',
      },
    };
  }

  try {
    const payload = (await response.json()) as { text?: unknown };
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (text.length === 0) {
      return {
        ok: false,
        error: {
          code: 'voice_cloud_stt_empty',
          message: 'Transcription returned no text',
          userMessage: "That didn't catch any speech. Try again.",
        },
      };
    }
    return { ok: true, value: text };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'voice_cloud_stt_unreadable',
        message: String(cause),
        userMessage: 'The transcription service sent something unreadable.',
        cause,
      },
    };
  }
}
