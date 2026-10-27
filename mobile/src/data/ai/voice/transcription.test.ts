import {
  __mockEnqueueJsonResponse,
  __mockGetFetchCalls,
  __mockResetFetch,
} from '../../../../__mocks__/expo-fetch';
import {
  __mockFailTranscribe,
  __mockResetExecutorch,
  __mockSetTranscription,
} from '../../../../__mocks__/react-native-executorch';
import {
  __mockMarkDownloaded,
  __mockResetModelFiles,
} from '../../../../__mocks__/react-native-blob-util';

import { transcribeTurn } from '@/data/ai/voice/transcription';
import { voiceModelSources } from '@/data/ai/voice/voiceModels';

let mockCloudOptIn = false;
jest.mock('@/data/user/preferencesRepository', () => ({
  getCloudSttOptIn: () => mockCloudOptIn,
}));

let mockConfig: {
  ok: boolean;
  value?: { provider: string; apiKey: string; baseUrl?: string } | null;
} = { ok: true, value: null };
jest.mock('@/data/ai/aiConfig', () => ({
  resolveAiConfig: () => Promise.resolve(mockConfig),
}));

const userDb = {} as never;

describe('transcribeTurn', () => {
  beforeEach(() => {
    __mockResetFetch();
    __mockResetExecutorch();
    __mockResetModelFiles();
    __mockMarkDownloaded(...(voiceModelSources() as string[]));
    mockCloudOptIn = false;
    mockConfig = { ok: true, value: null };
  });

  it('uses the on-device model by default', async () => {
    __mockSetTranscription('こんにちは');

    const result = await transcribeTurn(userDb, new Float32Array([0.1]));

    expect(result).toEqual({ ok: true, value: 'こんにちは' });
    expect(__mockGetFetchCalls()).toHaveLength(0);
  });

  it('never reaches for the cloud when on-device transcription fails (AC6)', async () => {
    __mockFailTranscribe(new Error('decode error'));

    const result = await transcribeTurn(userDb, new Float32Array([0.1]));

    expect(result.ok).toBe(false);
    expect(__mockGetFetchCalls()).toHaveLength(0);
  });

  it('uses the cloud only once the learner opts in', async () => {
    mockCloudOptIn = true;
    mockConfig = {
      ok: true,
      value: { provider: 'openai', apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1' },
    };
    __mockEnqueueJsonResponse({ text: 'クラウド' });

    const result = await transcribeTurn(userDb, new Float32Array([0.1]));

    expect(result).toEqual({ ok: true, value: 'クラウド' });
    expect(__mockGetFetchCalls()).toHaveLength(1);
  });

  it('does not silently fall back to on-device when the cloud call fails', async () => {
    mockCloudOptIn = true;
    mockConfig = {
      ok: true,
      value: { provider: 'openai', apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1' },
    };
    __mockSetTranscription('on-device would have worked');
    __mockEnqueueJsonResponse({ text: '' });

    const result = await transcribeTurn(userDb, new Float32Array([0.1]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_cloud_stt_empty');
    }
  });

  it('explains why cloud transcription cannot run on an Anthropic-only setup', async () => {
    mockCloudOptIn = true;
    mockConfig = { ok: true, value: { provider: 'anthropic', apiKey: 'sk-ant' } };

    const result = await transcribeTurn(userDb, new Float32Array([0.1]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_cloud_stt_unavailable');
    }
    expect(__mockGetFetchCalls()).toHaveLength(0);
  });
});
