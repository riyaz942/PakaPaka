import { createHash } from 'node:crypto';

export const CryptoDigestAlgorithm = {
  SHA256: 'SHA-256',
} as const;

export const CryptoEncoding = {
  HEX: 'hex',
  BASE64: 'base64',
} as const;

/**
 * Mirrors the real expo-crypto API: the input string is hashed as UTF-8 text,
 * and `options.encoding` selects the OUTPUT encoding of the digest (hex default).
 */
export async function digestStringAsync(
  algorithm: string,
  data: string,
  options?: { encoding?: string },
) {
  if (algorithm !== 'SHA-256') {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  const hash = createHash('sha256').update(data, 'utf8');
  return options?.encoding === CryptoEncoding.BASE64 ? hash.digest('base64') : hash.digest('hex');
}

/** Mirrors the real expo-crypto `digest`: hashes raw bytes, returns an ArrayBuffer. */
export async function digest(
  algorithm: string,
  data: ArrayBuffer | ArrayBufferView,
): Promise<ArrayBuffer> {
  if (algorithm !== 'SHA-256') {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  const bytes = ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data);
  const hashed = createHash('sha256').update(bytes).digest();
  return hashed.buffer.slice(hashed.byteOffset, hashed.byteOffset + hashed.byteLength);
}

let uuidCounter = 0;

/** Mirrors expo-crypto's `randomUUID`, but deterministic so tests can assert ids. */
export function randomUUID(): string {
  uuidCounter += 1;
  return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
}

export function __mockResetUuid(): void {
  uuidCounter = 0;
}
