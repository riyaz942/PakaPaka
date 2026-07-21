import {
  __mockEnqueueHttpError,
  __mockEnqueueJsonResponse,
  __mockGetFetchCalls,
  __mockResetFetch,
  __mockSetNetworkError,
} from '../../../../__mocks__/expo-fetch';

import { transcribeJapaneseViaCloud } from '@/data/ai/voice/cloudSttClient';

const options = { apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1' };

describe('transcribeJapaneseViaCloud', () => {
  beforeEach(() => {
    __mockResetFetch();
  });

  it('posts the audio to the transcription endpoint with the learner key', async () => {
    __mockEnqueueJsonResponse({ text: 'こんにちは' });

    const result = await transcribeJapaneseViaCloud(new Float32Array([0.1, 0.2]), options);

    expect(result).toEqual({ ok: true, value: 'こんにちは' });
    const [call] = __mockGetFetchCalls();
    expect(call.url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(call.headers.Authorization).toBe('Bearer sk-test');
  });

  it('asks for Japanese explicitly', async () => {
    __mockEnqueueJsonResponse({ text: 'はい' });

    await transcribeJapaneseViaCloud(new Float32Array([0.1]), options);

    const form = __mockGetFetchCalls()[0].rawBody as FormData;
    expect(form.get('language')).toBe('ja');
    expect(form.get('model')).toBe('whisper-1');
  });

  it('tolerates a base URL with a trailing slash', async () => {
    __mockEnqueueJsonResponse({ text: 'はい' });

    await transcribeJapaneseViaCloud(new Float32Array([0.1]), {
      ...options,
      baseUrl: 'https://api.openai.com/v1/',
    });

    expect(__mockGetFetchCalls()[0].url).toBe('https://api.openai.com/v1/audio/transcriptions');
  });

  it('refuses to send audio over plain http (NFR24)', async () => {
    const result = await transcribeJapaneseViaCloud(new Float32Array([0.1]), {
      ...options,
      baseUrl: 'http://example.com/v1',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_cloud_stt_insecure_url');
    }
    expect(__mockGetFetchCalls()).toHaveLength(0);
  });

  it('reports a rejected request', async () => {
    __mockEnqueueHttpError(401, 'bad key');

    const result = await transcribeJapaneseViaCloud(new Float32Array([0.1]), options);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_cloud_stt_rejected');
    }
  });

  it('reports an unreachable service', async () => {
    __mockSetNetworkError(new Error('offline'));

    const result = await transcribeJapaneseViaCloud(new Float32Array([0.1]), options);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_cloud_stt_unreachable');
    }
  });

  it('treats an empty transcript as nothing heard', async () => {
    __mockEnqueueJsonResponse({ text: '  ' });

    const result = await transcribeJapaneseViaCloud(new Float32Array([0.1]), options);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_cloud_stt_empty');
    }
  });
});
