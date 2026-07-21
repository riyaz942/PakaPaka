import {
  __mockFailRecorderStart,
  __mockPermissionRequestCount,
  __mockPlayedBuffers,
  __mockResetAudioApi,
  __mockSetPermission,
  __mockSetPermissionRequestResult,
  __mockSetRecordedChunks,
} from '../../../../__mocks__/react-native-audio-api';

import {
  ensureMicrophonePermission,
  playWaveform,
  resampleTo16kHz,
  startRecording,
  stopRecording,
} from '@/data/ai/voice/audioSession';
import { TTS_SAMPLE_RATE } from '@/data/ai/voice/voiceModels';

describe('audioSession', () => {
  beforeEach(() => {
    __mockResetAudioApi();
  });

  describe('resampleTo16kHz', () => {
    it('returns the input untouched when it is already 16 kHz', () => {
      const samples = new Float32Array([0.1, 0.2, 0.3]);

      expect(resampleTo16kHz(samples, 16000)).toBe(samples);
    });

    it('halves the sample count when downsampling from 32 kHz', () => {
      const samples = new Float32Array([0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25]);

      const resampled = resampleTo16kHz(samples, 32000);

      expect(resampled).toHaveLength(4);
      expect(resampled[0]).toBeCloseTo(0);
      expect(resampled[1]).toBeCloseTo(0.5);
    });

    it('preserves duration when downsampling from 48 kHz', () => {
      const samples = new Float32Array(48000);

      expect(resampleTo16kHz(samples, 48000)).toHaveLength(16000);
    });

    it('returns an empty array for empty input', () => {
      expect(resampleTo16kHz(new Float32Array(0), 44100)).toHaveLength(0);
    });

    it('returns the input untouched when the source rate is non-positive', () => {
      const samples = new Float32Array([0.1, 0.2]);

      expect(resampleTo16kHz(samples, 0)).toBe(samples);
      expect(resampleTo16kHz(samples, Number.NaN)).toBe(samples);
    });
  });

  describe('ensureMicrophonePermission', () => {
    it('succeeds when the learner grants access', async () => {
      __mockSetPermission('Undetermined');

      const result = await ensureMicrophonePermission();

      expect(result.ok).toBe(true);
      expect(__mockPermissionRequestCount()).toBe(1);
    });

    it('reports a denial rather than recording silently', async () => {
      __mockSetPermission('Undetermined');
      __mockSetPermissionRequestResult('Denied');

      const result = await ensureMicrophonePermission();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_microphone_denied');
      }
    });

    it('does not re-prompt when permission is already granted', async () => {
      __mockSetPermission('Granted');

      await ensureMicrophonePermission();

      expect(__mockPermissionRequestCount()).toBe(0);
    });
  });

  describe('recording', () => {
    it('returns the captured audio as a single 16 kHz waveform', async () => {
      __mockSetRecordedChunks([new Float32Array([0.1, 0.2]), new Float32Array([0.3])], 16000);

      await startRecording();
      const result = await stopRecording();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.from(result.value)).toEqual([
          expect.closeTo(0.1),
          expect.closeTo(0.2),
          expect.closeTo(0.3),
        ]);
      }
    });

    it('resamples hardware that ignores the requested rate', async () => {
      __mockSetRecordedChunks([new Float32Array(48000)], 48000);

      await startRecording();
      const result = await stopRecording();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(16000);
      }
    });

    it('surfaces a recorder Result error instead of returning silence', async () => {
      __mockFailRecorderStart(new Error('mic busy'), true);

      const result = await startRecording();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_recording_failed');
      }
    });

    it('reports an error when stopping without having recorded anything', async () => {
      const result = await stopRecording();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_recording_empty');
      }
    });
  });

  describe('playWaveform', () => {
    it('sends the synthesized samples to the speaker at the TTS sample rate', async () => {
      const samples = new Float32Array([0.5, -0.5, 0.25]);

      const result = await playWaveform(samples);

      expect(result.ok).toBe(true);
      const played = __mockPlayedBuffers();
      expect(played).toHaveLength(1);
      expect(played[0].sampleRate).toBe(TTS_SAMPLE_RATE);
      expect(Array.from(played[0].samples)).toEqual([0.5, -0.5, 0.25]);
    });

    it('reports an error for an empty waveform rather than pretending it played', async () => {
      const result = await playWaveform(new Float32Array(0));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('voice_playback_empty');
      }
    });
  });
});
