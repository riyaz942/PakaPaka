import {
  __mockExecutorchState,
  __mockFailSynthesize,
  __mockFailTtsLoad,
  __mockResetExecutorch,
  __mockSetSynthesis,
} from '../../../../__mocks__/react-native-executorch';
import {
  __mockMarkDownloaded,
  __mockResetModelFiles,
} from '../../../../__mocks__/react-native-blob-util';

import { releaseTtsModel, synthesizeJapanese } from '@/data/ai/voice/ttsClient';
import { voiceModelSources } from '@/data/ai/voice/voiceModels';

describe('ttsClient', () => {
  beforeEach(() => {
    __mockResetExecutorch();
    __mockResetModelFiles();
    __mockMarkDownloaded(...(voiceModelSources() as string[]));
    releaseTtsModel();
  });

  it('synthesizes a waveform from Japanese text', async () => {
    __mockSetSynthesis(new Float32Array([0.1, 0.2, 0.3]));

    const result = await synthesizeJapanese('こんにちは');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(result.value)).toHaveLength(3);
    }
    expect(__mockExecutorchState().synthesizeCalls).toEqual(['こんにちは']);
  });

  it('speaks Japanese with the one downloaded voice', async () => {
    __mockSetSynthesis(new Float32Array([0.1]));

    await synthesizeJapanese('こんにちは');

    expect(__mockExecutorchState().synthesizeOptions).toEqual([{ voiceStyle: 'F1', lang: 'ja' }]);
  });

  it('refuses to load when the models are not on disk', async () => {
    __mockResetModelFiles();

    const result = await synthesizeJapanese('こんにちは');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_tts_models_missing');
    }
    expect(__mockExecutorchState().ttsLoadCount).toBe(0);
  });

  it('loads the model once and reuses it across replies', async () => {
    __mockSetSynthesis(new Float32Array([0.1]));

    await synthesizeJapanese('一つ目');
    await synthesizeJapanese('二つ目');

    expect(__mockExecutorchState().ttsLoadCount).toBe(1);
  });

  it('reports a load failure rather than falling back to another voice', async () => {
    __mockFailTtsLoad(new Error('model missing'));

    const result = await synthesizeJapanese('こんにちは');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_tts_load_failed');
    }
  });

  it('reports a synthesis failure', async () => {
    __mockFailSynthesize(new Error('inference error'));

    const result = await synthesizeJapanese('こんにちは');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_tts_failed');
    }
  });

  it('treats an empty synthesis waveform as failure', async () => {
    __mockSetSynthesis(new Float32Array(0));

    const result = await synthesizeJapanese('こんにちは');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_tts_failed');
    }
  });

  it('rejects empty text without loading the model', async () => {
    const result = await synthesizeJapanese('   ');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('voice_tts_empty_text');
    }
    expect(__mockExecutorchState().ttsLoadCount).toBe(0);
  });
});
