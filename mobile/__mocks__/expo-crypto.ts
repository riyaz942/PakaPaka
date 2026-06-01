import { createHash } from 'node:crypto';

export const CryptoDigestAlgorithm = {
  SHA256: 'SHA-256',
} as const;

export const CryptoEncoding = {
  HEX: 'hex',
  BASE64: 'base64',
} as const;

export async function digestStringAsync(
  algorithm: string,
  data: string,
  options?: { encoding?: string },
) {
  if (algorithm !== 'SHA-256') {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  const input =
    options?.encoding === CryptoEncoding.BASE64 ? Buffer.from(data, 'base64') : Buffer.from(data);

  return createHash('sha256').update(input).digest('hex');
}
