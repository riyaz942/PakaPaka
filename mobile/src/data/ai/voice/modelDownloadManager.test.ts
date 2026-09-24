import {
  __mockFailFetch,
  __mockFailListDownloaded,
  __mockFailSizeProbe,
  __mockFetchCallCount,
  __mockCancelCallCount,
  __mockMarkDownloaded,
  __mockResetResourceFetcher,
  __mockSetRemoteSize,
} from '../../../../__mocks__/react-native-executorch-expo-resource-fetcher';

import {
  areVoiceModelsDownloaded,
  cancelVoiceModelDownload,
  downloadVoiceModels,
  getVoiceModelDownloadBytes,
} from '@/data/ai/voice/modelDownloadManager';
import { voiceModelSources } from '@/data/ai/voice/voiceModels';

// jest-expo's setup stubs this path with a stateless getInfoAsync that always says
// "exists". Use the project mock, whose store the resource-fetcher mock writes to.
jest.mock('expo-file-system/legacy', () =>
  jest.requireActual('../../../../__mocks__/expo-file-system'),
);

describe('modelDownloadManager', () => {
  beforeEach(() => {
    __mockResetResourceFetcher();
  });

  describe('areVoiceModelsDownloaded', () => {
    it('reports false when no model file is on disk', async () => {
      const result = await areVoiceModelsDownloaded();

      expect(result).toEqual({ ok: true, value: false });
    });

    it('reports false when only some model files are present', async () => {
      const sources = voiceModelSources();
      __mockMarkDownloaded(...(sources.slice(0, 2) as string[]));

      const result = await areVoiceModelsDownloaded();

      expect(result).toEqual({ ok: true, value: false });
    });

    it('reports true only once every model file is present', async () => {
      __mockMarkDownloaded(...(voiceModelSources() as string[]));

      const result = await areVoiceModelsDownloaded();

      expect(result).toEqual({ ok: true, value: true });
    });

    it('reports false without listing when the model directory does not exist yet', async () => {
      __mockFailListDownloaded(new Error('listing a missing directory must not happen'));

      const result = await areVoiceModelsDownloaded();

      expect(result).toEqual({ ok: true, value: false });
    });

    it('reports a check failure when the directory exists but cannot be listed', async () => {
      __mockMarkDownloaded();
      __mockFailListDownloaded(new Error('permission denied'));

      const result = await areVoiceModelsDownloaded();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_model_check_failed');
      }
    });
  });

  describe('getVoiceModelDownloadBytes', () => {
    it('sums the real remote sizes of every model file', async () => {
      const sources = voiceModelSources() as string[];
      for (const source of sources) {
        __mockSetRemoteSize(source, 1_000_000);
      }

      const result = await getVoiceModelDownloadBytes();

      expect(result).toEqual({ ok: true, value: sources.length * 1_000_000 });
    });

    it('returns an error rather than a guessed size when the probe fails', async () => {
      __mockFailSizeProbe(new Error('offline'));

      const result = await getVoiceModelDownloadBytes();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_model_size_unavailable');
      }
    });

    it('returns an error when a HEAD probe under-reports as zero', async () => {
      const sources = voiceModelSources() as string[];
      __mockSetRemoteSize(sources[0], 1_000_000);
      // Remaining sources intentionally unset → mock returns 0 for those.

      const result = await getVoiceModelDownloadBytes();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_model_size_unavailable');
      }
    });
  });

  describe('downloadVoiceModels', () => {
    it('downloads every model source and reports progress', async () => {
      const progress: number[] = [];

      const result = await downloadVoiceModels((value) => progress.push(value));

      expect(result.ok).toBe(true);
      expect(progress).toEqual([0.5, 1]);
      await expect(areVoiceModelsDownloaded()).resolves.toEqual({ ok: true, value: true });
    });

    it('leaves nothing behind that a presence check would mistake for a complete download', async () => {
      __mockFailFetch(new Error('connection lost'));

      const result = await downloadVoiceModels();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_model_download_failed');
      }
      await expect(areVoiceModelsDownloaded()).resolves.toEqual({ ok: true, value: false });
    });

    it('does not start a download merely by importing the module', () => {
      expect(__mockFetchCallCount()).toBe(0);
    });
  });

  describe('cancelVoiceModelDownload', () => {
    it('succeeds when nothing is in flight', async () => {
      const result = await cancelVoiceModelDownload();

      expect(result.ok).toBe(true);
      expect(__mockCancelCallCount()).toBe(1);
    });
  });
});
