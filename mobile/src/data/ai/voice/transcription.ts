import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_OPENAI_BASE_URL } from '@/data/ai/byokCredential.types';
import { resolveAiConfig } from '@/data/ai/aiConfig';
import { transcribeJapaneseViaCloud } from '@/data/ai/voice/cloudSttClient';
import { transcribeJapanese } from '@/data/ai/voice/sttClient';
import { getCloudSttOptIn } from '@/data/user/preferencesRepository';
import type { Result } from '@/types/result.types';

/**
 * The single decision about where a spoken turn gets transcribed (FR99, UX-DR33).
 *
 * The rule is symmetric and has no fallback in either direction: with the
 * toggle off, transcription is on-device and an on-device failure stays a
 * failure — it never quietly reaches for the network with the learner's audio.
 * With it on, transcription is cloud-only and a cloud failure is reported
 * rather than silently retried on-device.
 *
 * Only the OpenAI-compatible adapter exposes a transcription endpoint, so an
 * Anthropic-only setup with the toggle on is an explicit error telling the
 * learner why, not an invisible downgrade.
 */
export async function transcribeTurn(
  userDb: SQLiteDatabase,
  waveform: Float32Array,
): Promise<Result<string>> {
  if (!getCloudSttOptIn(userDb)) {
    return transcribeJapanese(waveform);
  }

  const config = await resolveAiConfig(userDb);
  if (!config.ok) {
    return config;
  }
  if (!config.value || config.value.provider !== 'openai') {
    return {
      ok: false,
      error: {
        code: 'voice_cloud_stt_unavailable',
        message: 'Cloud transcription needs an OpenAI-compatible key',
        userMessage:
          'Cloud transcription needs an OpenAI-compatible key. Add one in Settings, or turn cloud transcription off to use the on-device model.',
      },
    };
  }

  return transcribeJapaneseViaCloud(waveform, {
    apiKey: config.value.apiKey,
    baseUrl: config.value.baseUrl ?? DEFAULT_OPENAI_BASE_URL,
  });
}
