import { encodeWav16BitPcm } from '@/data/ai/voice/wav';

function readAscii(view: DataView, offset: number, length: number): string {
  let text = '';
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(view.getUint8(offset + index));
  }
  return text;
}

describe('encodeWav16BitPcm', () => {
  it('writes a RIFF/WAVE container', () => {
    const view = new DataView(encodeWav16BitPcm(new Float32Array([0, 0.5]), 16000));

    expect(readAscii(view, 0, 4)).toBe('RIFF');
    expect(readAscii(view, 8, 4)).toBe('WAVE');
    expect(readAscii(view, 12, 4)).toBe('fmt ');
    expect(readAscii(view, 36, 4)).toBe('data');
  });

  it('describes mono 16-bit PCM at the given sample rate', () => {
    const view = new DataView(encodeWav16BitPcm(new Float32Array([0]), 16000));

    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
  });

  it('sizes the buffer as header plus two bytes per sample', () => {
    const buffer = encodeWav16BitPcm(new Float32Array(100), 16000);

    expect(buffer.byteLength).toBe(44 + 200);
  });

  it('scales floats to signed 16-bit', () => {
    const view = new DataView(encodeWav16BitPcm(new Float32Array([0, 1, -1]), 16000));

    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
  });

  it('clamps samples outside the -1..1 range instead of wrapping', () => {
    const view = new DataView(encodeWav16BitPcm(new Float32Array([2, -2]), 16000));

    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });
});
