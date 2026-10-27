import {
  __mockDownloadCallCount,
  __mockFailDownload,
  __mockFailExistsCheck,
  __mockFailSizeProbe,
  __mockMarkDownloaded,
  __mockResetModelFiles,
  __mockSetRemoteSize,
  __mockSetRemoteStatus,
} from '../../../../__mocks__/react-native-blob-util';

import {
  areVoiceModelsDownloaded,
  cancelVoiceModelDownload,
  downloadVoiceModels,
  getVoiceModelDownloadBytes,
} from '@/data/ai/voice/modelDownloadManager';
import { voiceModelSources } from '@/data/ai/voice/voiceModels';

describe('modelDownloadManager', () => {
  beforeEach(() => {
    __mockResetModelFiles();
  });

  describe('voiceModelSources', () => {
    it('lists only the one voice style, not every Supertonic voice', () => {
      const voiceStyles = voiceModelSources().filter((source) => source.includes('voice_styles'));

      expect(voiceStyles).toEqual(['https://models.test/supertonic/voice_styles/F1.json']);
    });

    it('includes the voice activity model Whisper loads with', () => {
      expect(voiceModelSources()).toContain('https://models.test/fsmn-vad/fsmn_vad.pte');
    });
  });

  describe('areVoiceModelsDownloaded', () => {
    it('reports false when no model file is on disk', async () => {
      const result = await areVoiceModelsDownloaded();

      expect(result).toEqual({ ok: true, value: false });
    });

    it('reports false when only some model files are present', async () => {
      __mockMarkDownloaded(...voiceModelSources().slice(0, 2));

      const result = await areVoiceModelsDownloaded();

      expect(result).toEqual({ ok: true, value: false });
    });

    it('reports true only once every model file is present', async () => {
      __mockMarkDownloaded(...voiceModelSources());

      const result = await areVoiceModelsDownloaded();

      expect(result).toEqual({ ok: true, value: true });
    });

    it('reports a check failure when the disk cannot be read', async () => {
      __mockFailExistsCheck(new Error('permission denied'));

      const result = await areVoiceModelsDownloaded();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_model_check_failed');
      }
    });
  });

  describe('getVoiceModelDownloadBytes', () => {
    it('sums the real remote sizes of every model file', async () => {
      const sources = voiceModelSources();
      for (const source of sources) {
        __mockSetRemoteSize(source, 1_000_000);
      }

      const result = await getVoiceModelDownloadBytes();

      expect(result).toEqual({ ok: true, value: sources.length * 1_000_000 });
    });

    it('blames the connection when the server cannot be reached', async () => {
      __mockFailSizeProbe(new Error('offline'));

      const result = await getVoiceModelDownloadBytes();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_model_size_unavailable');
        expect(result.error.userMessage).toMatch(/check your connection/i);
      }
    });

    it('does not blame the connection when the server answers that a file is missing', async () => {
      const sources = voiceModelSources();
      for (const source of sources) {
        __mockSetRemoteSize(source, 1_000_000);
      }
      __mockSetRemoteStatus(sources[sources.length - 1], 404);

      const result = await getVoiceModelDownloadBytes();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_model_unavailable');
        expect(result.error.message).toContain('HTTP 404');
        expect(result.error.userMessage).not.toMatch(/check your connection/i);
      }
    });

    it('returns an error rather than a guessed size when a file has no size', async () => {
      const sources = voiceModelSources();
      __mockSetRemoteSize(sources[0], 1_000_000);
      // Remaining sources unset → a 302 with only the redirect body's Content-Length.

      const result = await getVoiceModelDownloadBytes();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_model_size_unavailable');
        expect(result.error.userMessage).not.toMatch(/check your connection/i);
      }
    });
  });

  describe('downloadVoiceModels', () => {
    it('downloads every model source and reports progress', async () => {
      const progress: number[] = [];

      const result = await downloadVoiceModels((value) => progress.push(value));

      expect(result.ok).toBe(true);
      expect(progress).toEqual([0.5, 1]);
      await expect(areVoiceModelsDownloaded()).resolves.toEqual({
        ok: true,
        value: true,
      });
    });

    it('leaves nothing behind that a presence check would mistake for a complete download', async () => {
      __mockFailDownload(new Error('connection lost'));

      const result = await downloadVoiceModels();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_model_download_failed');
      }
      await expect(areVoiceModelsDownloaded()).resolves.toEqual({
        ok: true,
        value: false,
      });
    });

    it('does not start a download merely by importing the module', () => {
      expect(__mockDownloadCallCount()).toBe(0);
    });
  });

  describe('cancelVoiceModelDownload', () => {
    it('succeeds when nothing is in flight', async () => {
      const result = await cancelVoiceModelDownload();

      expect(result.ok).toBe(true);
    });

    it('aborts the download in flight', async () => {
      const pending = downloadVoiceModels();
      await cancelVoiceModelDownload();

      const result = await pending;

      expect(result.ok).toBe(false);
      await expect(areVoiceModelsDownloaded()).resolves.toEqual({
        ok: true,
        value: false,
      });
    });
  });
});
