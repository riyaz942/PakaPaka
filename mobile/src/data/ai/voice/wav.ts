/**
 * Minimal WAV container for the cloud transcription upload.
 *
 * Transcription endpoints take an audio file, not a raw sample array, so the
 * captured waveform is wrapped in the smallest header that describes it. Only
 * mono 16-bit PCM is produced — that is exactly what the recorder delivers
 * after resampling, so there is nothing to configure.
 */

const HEADER_BYTES = 44;
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

export function encodeWav16BitPcm(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);
  const byteRate = (sampleRate * CHANNELS * BITS_PER_SAMPLE) / 8;

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, HEADER_BYTES - 8 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');

  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, (CHANNELS * BITS_PER_SAMPLE) / 8, true); // block align
  view.setUint16(34, BITS_PER_SAMPLE, true);

  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let index = 0; index < samples.length; index += 1) {
    // Clamp before scaling: a sample past full scale would otherwise wrap to
    // the opposite extreme and read as a loud click.
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(
      HEADER_BYTES + index * 2,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
  }

  return buffer;
}
