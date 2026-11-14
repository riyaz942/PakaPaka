import * as native from './voiceModels';
import * as web from './voiceModels.web';

describe('voiceModels.web', () => {
  it('keeps the sample rates in step with the native module', () => {
    expect(web.STT_SAMPLE_RATE).toBe(native.STT_SAMPLE_RATE);
    expect(web.TTS_SAMPLE_RATE).toBe(native.TTS_SAMPLE_RATE);
  });

  it('refuses loudly if anything asks for the voice model files on web', () => {
    expect(() => web.voiceModelSources()).toThrow('Voice models are not available on web');
  });
});
