import {
  __mockExecutorchState,
  __mockFailSttLoad,
  __mockFailTranscribe,
  __mockResetExecutorch,
  __mockSetTranscription,
} from '../../../../__mocks__/react-native-executorch';
import {
  __mockMarkDownloaded,
  __mockResetResourceFetcher,
} from '../../../../__mocks__/react-native-executorch-expo-resource-fetcher';

import { releaseSttModel, transcribeJapanese } from '@/data/ai/voice/sttClient';
import { voiceModelSources } from '@/data/ai/voice/voiceModels';

describe('sttClient', () => {
  beforeEach(() => {
    __mockResetExecutorch();
    __mockResetResourceFetcher();
    __mockMarkDownloaded(...(voiceModelSources() as string[]));
    releaseSttModel();
  });

  it('transcribes a waveform as Japanese', async () => {
    __mockSetTranscription('こんにちは');

    const result = await transcribeJapanese(new Float32Array([0.1, 0.2]));

    expect(result).toEqual({ ok: true, value: 'こんにちは' });
    expect(__mockExecutorchState().transcribeCalls[0].language).toBe('ja');
  });

  it('refuses to load when the models are not on disk', async () => {
    __mockResetResourceFetcher();

    const result = await transcribeJapanese(new Float32Array([0.1]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_stt_models_missing');
    }
    expect(__mockExecutorchState().sttLoadCount).toBe(0);
  });

  it('initialises the executorch runtime before the first transcription', async () => {
    // A fresh module registry: runtime setup is intentionally once-per-process,
    // so this only means anything before anything else has touched it.
    await jest.isolateModulesAsync(async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs a runtime require to hit the fresh registry
      const executorch = require('react-native-executorch');
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- same: a static import would bind the outer registry's module
      const { transcribeJapanese: freshTranscribe } = require('@/data/ai/voice/sttClient');
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- keep the isolated registry's download state in sync
      const resourceFetcher = require('../../../../__mocks__/react-native-executorch-expo-resource-fetcher') as {
        __mockMarkDownloaded: (...uris: string[]) => void;
        __mockResetResourceFetcher: () => void;
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- voiceModelSources must resolve against the isolated executorch registry
      const { voiceModelSources: isolatedSources } = require('@/data/ai/voice/voiceModels') as {
        voiceModelSources: () => string[];
      };

      resourceFetcher.__mockResetResourceFetcher();
      resourceFetcher.__mockMarkDownloaded(...isolatedSources());
      await freshTranscribe(new Float32Array([0.1]));

      expect(executorch.__mockExecutorchState().initCount).toBe(1);
    });
  });

  it('loads the model once and reuses it across transcriptions', async () => {
    await transcribeJapanese(new Float32Array([0.1]));
    await transcribeJapanese(new Float32Array([0.2]));

    expect(__mockExecutorchState().sttLoadCount).toBe(1);
  });

  it('reports a load failure instead of returning empty text', async () => {
    __mockFailSttLoad(new Error('model missing'));

    const result = await transcribeJapanese(new Float32Array([0.1]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_stt_load_failed');
    }
  });

  it('reports a transcription failure rather than a blank transcript', async () => {
    __mockFailTranscribe(new Error('decode error'));

    const result = await transcribeJapanese(new Float32Array([0.1]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_stt_failed');
    }
  });

  it('treats a whitespace-only transcript as nothing heard', async () => {
    __mockSetTranscription('   ');

    const result = await transcribeJapanese(new Float32Array([0.1]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_stt_empty');
    }
  });

  it('reloads the model after it is released', async () => {
    await transcribeJapanese(new Float32Array([0.1]));
    releaseSttModel();
    await transcribeJapanese(new Float32Array([0.2]));

    expect(__mockExecutorchState().sttLoadCount).toBe(2);
  });
});
