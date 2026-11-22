import { ed25519 } from '@noble/curves/ed25519.js';
import signingKeys from '@/config/curriculum-signing-keys.json';
import type { CurriculumRelease } from '@/data/curriculum/curriculumManifest.types';
import type { AppError, Result } from '@/types/result.types';

export const SIGNING_KEYS: Readonly<Record<string, string>> = signingKeys;

const MANIFEST_FORMAT = 'pakapaka-curriculum-manifest';

function fail(code: string, message: string): Result<CurriculumRelease, AppError> {
  return { ok: false, error: { code, message } };
}

/** Strict base64 decode with atob (Hermes and browsers have it). Null when invalid. */
function decodeBase64(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4 !== 0) return null;
  try {
    const binary = globalThis.atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

/**
 * Check order: envelope shape, key for keyId, signature, payload JSON and field types,
 * schema. The payload is not read before the signature is good.
 */
export function verifySignedManifest(
  raw: unknown,
  keys: Readonly<Record<string, string>>,
  requiredSchema: number,
): Result<CurriculumRelease, AppError> {
  const m = raw as Record<string, unknown> | null;
  if (
    typeof m !== 'object' ||
    m === null ||
    m.format !== MANIFEST_FORMAT ||
    m.formatVersion !== 1 ||
    typeof m.keyId !== 'string' ||
    typeof m.payload !== 'string' ||
    typeof m.signature !== 'string'
  ) {
    return fail('CURRICULUM_MANIFEST_INVALID', 'Curriculum manifest has a bad envelope');
  }
  const { keyId } = m;

  if (!Object.prototype.hasOwnProperty.call(keys, keyId)) {
    return fail('CURRICULUM_SIGNATURE_INVALID', 'Curriculum manifest key is not known');
  }
  const payloadBytes = decodeBase64(m.payload);
  const signature = decodeBase64(m.signature);
  const publicKey = decodeBase64(keys[keyId]);
  if (
    payloadBytes === null ||
    signature === null ||
    publicKey === null ||
    signature.length !== 64 ||
    publicKey.length !== 32
  ) {
    return fail('CURRICULUM_SIGNATURE_INVALID', 'Curriculum manifest signature cannot be read');
  }

  let valid = false;
  try {
    valid = ed25519.verify(signature, payloadBytes, publicKey);
  } catch {
    valid = false;
  }
  if (!valid) {
    return fail('CURRICULUM_SIGNATURE_INVALID', 'Curriculum manifest signature does not match');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes));
  } catch {
    return fail('CURRICULUM_MANIFEST_INVALID', 'Curriculum manifest payload is not JSON');
  }
  const p = parsed as Record<string, unknown> | null;
  if (
    typeof p !== 'object' ||
    p === null ||
    !isPositiveInt(p.schema) ||
    !isPositiveInt(p.version) ||
    typeof p.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(p.sha256) ||
    typeof p.size_bytes !== 'number' ||
    !Number.isInteger(p.size_bytes) ||
    p.size_bytes < 0 ||
    typeof p.published_at !== 'string'
  ) {
    return fail('CURRICULUM_MANIFEST_INVALID', 'Curriculum manifest payload has bad fields');
  }

  if (p.schema !== requiredSchema) {
    return fail('CURRICULUM_SCHEMA_MISMATCH', 'Curriculum release is for another schema');
  }

  return {
    ok: true,
    value: {
      schema: p.schema,
      version: p.version,
      sha256: p.sha256,
      sizeBytes: p.size_bytes,
      publishedAt: p.published_at,
      keyId,
    },
  };
}
