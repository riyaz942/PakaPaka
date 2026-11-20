/**
 * Signing helpers for curriculum release manifests (Ed25519).
 * Signed bytes = the bytes that base64-decoding `payload` gives.
 */
import { createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ManifestPayload = {
  schema: number;
  version: number;
  sha256: string;
  size_bytes: number;
  published_at: string;
};

export type SignedManifest = {
  format: 'pakapaka-curriculum-manifest';
  formatVersion: 1;
  keyId: string;
  payload: string;
  signature: string;
};

const MANIFEST_FORMAT = 'pakapaka-curriculum-manifest';

/** UTF-8 JSON with the fixed key order. */
export function encodePayload(p: ManifestPayload): Buffer {
  return Buffer.from(
    JSON.stringify({
      schema: p.schema,
      version: p.version,
      sha256: p.sha256,
      size_bytes: p.size_bytes,
      published_at: p.published_at,
    }),
    'utf8',
  );
}

export function signManifest(p: ManifestPayload, keyId: string, privateKey: KeyObject): SignedManifest {
  const bytes = encodePayload(p);
  return {
    format: MANIFEST_FORMAT,
    formatVersion: 1,
    keyId,
    payload: bytes.toString('base64'),
    signature: sign(null, bytes, privateKey).toString('base64'),
  };
}

/** Check order: envelope shape, key for keyId, signature, payload JSON and field types. */
export function verifyManifest(raw: unknown, publicKeys: Record<string, string>): ManifestPayload {
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
    throw new Error('bad envelope');
  }
  if (!Object.prototype.hasOwnProperty.call(publicKeys, m.keyId)) throw new Error('unknown key');
  const payloadBytes = Buffer.from(m.payload, 'base64');
  const signature = Buffer.from(m.signature, 'base64');
  if (!verify(null, payloadBytes, publicKeyFromBase64(publicKeys[m.keyId]), signature)) {
    throw new Error('bad signature');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBytes.toString('utf8'));
  } catch {
    throw new Error('bad payload');
  }
  const p = parsed as Record<string, unknown> | null;
  if (
    typeof p !== 'object' ||
    p === null ||
    !Number.isInteger(p.schema) ||
    !Number.isInteger(p.version) ||
    (p.version as number) < 1 ||
    typeof p.sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(p.sha256) ||
    !Number.isInteger(p.size_bytes) ||
    (p.size_bytes as number) < 0 ||
    typeof p.published_at !== 'string'
  ) {
    throw new Error('bad payload');
  }
  return {
    schema: p.schema as number,
    version: p.version as number,
    sha256: p.sha256,
    size_bytes: p.size_bytes as number,
    published_at: p.published_at,
  };
}

/** Raw 32-byte public key as standard base64. Takes a public or a private key. */
export function publicKeyBase64(key: KeyObject): string {
  const pub = key.type === 'private' ? createPublicKey(key) : key;
  const { x } = pub.export({ format: 'jwk' });
  return Buffer.from(x as string, 'base64url').toString('base64');
}

export function publicKeyFromBase64(b64: string): KeyObject {
  const x = Buffer.from(b64, 'base64').toString('base64url');
  return createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' });
}

export function readSigningKeys(repoRoot: string): Record<string, string> {
  const file = join(repoRoot, 'mobile', 'src', 'config', 'curriculum-signing-keys.json');
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
}

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'latin1');

/** True when the first 16 bytes are the SQLite header (a Git LFS pointer is not). */
export function isSqliteFile(head: Buffer): boolean {
  return head.length >= 16 && head.subarray(0, 16).equals(SQLITE_HEADER);
}

export function checkNewerThanLive(newVersion: number, live: ManifestPayload | null): void {
  if (live && live.version >= newVersion) {
    throw new Error(`live version ${live.version} is not older than ${newVersion}`);
  }
}

export function checkKeyMatches(privateKey: KeyObject, keyId: string, keys: Record<string, string>): void {
  if (!Object.prototype.hasOwnProperty.call(keys, keyId)) {
    throw new Error(`keyId ${keyId} is not in curriculum-signing-keys.json`);
  }
  if (publicKeyBase64(privateKey) !== keys[keyId]) {
    throw new Error(`the key file does not match ${keyId}`);
  }
}

export function buildPayload(
  seed: { version: number; sha256: string; sizeBytes: number },
  schema: number,
  now: Date,
): ManifestPayload {
  return {
    schema,
    version: seed.version,
    sha256: seed.sha256,
    size_bytes: seed.sizeBytes,
    published_at: now.toISOString(),
  };
}
