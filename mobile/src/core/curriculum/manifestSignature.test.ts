import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { SIGNING_KEYS, verifySignedManifest } from './manifestSignature';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fixture = require('../../../../scripts/__fixtures__/curriculum-signed-manifest.json');

type Payload = Record<string, unknown>;

const GOOD: Payload = {
  schema: 1,
  version: 54,
  sha256: 'ab'.repeat(32),
  size_bytes: 1024,
  published_at: '2026-11-20T00:00:00.000Z',
};

function makeKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  return { privateKey, publicB64: Buffer.from(raw).toString('base64') };
}

function signBytes(bytes: Buffer, privateKey: KeyObject, keyId = 'k1') {
  return {
    format: 'pakapaka-curriculum-manifest',
    formatVersion: 1,
    keyId,
    payload: bytes.toString('base64'),
    signature: sign(null, bytes, privateKey).toString('base64'),
  };
}

function signPayload(p: Payload, privateKey: KeyObject, keyId = 'k1') {
  return signBytes(Buffer.from(JSON.stringify(p), 'utf8'), privateKey, keyId);
}

function errorCode(r: ReturnType<typeof verifySignedManifest>): string | undefined {
  return r.ok ? undefined : r.error.code;
}

describe('verifySignedManifest', () => {
  const a = makeKey();
  const b = makeKey();
  const keys = { k1: a.publicB64 };

  it('accepts a good manifest', () => {
    const r = verifySignedManifest(signPayload(GOOD, a.privateKey), keys, 1);
    expect(r).toEqual({
      ok: true,
      value: {
        schema: 1,
        version: 54,
        sha256: 'ab'.repeat(32),
        sizeBytes: 1024,
        publishedAt: '2026-11-20T00:00:00.000Z',
        keyId: 'k1',
      },
    });
  });

  it('accepts the scripts fixture with its _testPublicKey', () => {
    const r = verifySignedManifest(fixture, { test: fixture._testPublicKey }, 1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.version).toBe(54);
      expect(r.value.keyId).toBe('test');
    }
  });

  it('rejects an unsigned manifest', () => {
    const { signature: _signature, ...unsigned } = signPayload(GOOD, a.privateKey);
    expect(errorCode(verifySignedManifest(unsigned, keys, 1))).toBe('CURRICULUM_MANIFEST_INVALID');
  });

  it('rejects a tampered payload', () => {
    const m = signPayload(GOOD, a.privateKey);
    const text = Buffer.from(m.payload, 'base64').toString('utf8').replace('"version":54', '"version":99');
    m.payload = Buffer.from(text, 'utf8').toString('base64');
    expect(errorCode(verifySignedManifest(m, keys, 1))).toBe('CURRICULUM_SIGNATURE_INVALID');
  });

  it('rejects a tampered signature', () => {
    const m = signPayload(GOOD, a.privateKey);
    const sig = Buffer.from(m.signature, 'base64');
    sig[0] ^= 1;
    m.signature = sig.toString('base64');
    expect(errorCode(verifySignedManifest(m, keys, 1))).toBe('CURRICULUM_SIGNATURE_INVALID');
  });

  it('rejects a manifest signed by a wrong key', () => {
    const m = signPayload(GOOD, b.privateKey, 'k1');
    expect(errorCode(verifySignedManifest(m, keys, 1))).toBe('CURRICULUM_SIGNATURE_INVALID');
  });

  it('rejects an unknown keyId', () => {
    const m = signPayload(GOOD, a.privateKey, 'k9');
    expect(errorCode(verifySignedManifest(m, keys, 1))).toBe('CURRICULUM_SIGNATURE_INVALID');
  });

  it('rejects a 63-byte signature', () => {
    const m = signPayload(GOOD, a.privateKey);
    m.signature = Buffer.from(m.signature, 'base64').subarray(0, 63).toString('base64');
    expect(errorCode(verifySignedManifest(m, keys, 1))).toBe('CURRICULUM_SIGNATURE_INVALID');
  });

  it('rejects a configured key with bad base64 or wrong length without throwing', () => {
    const m = signPayload(GOOD, a.privateKey);
    expect(errorCode(verifySignedManifest(m, { k1: '***not base64***' }, 1))).toBe(
      'CURRICULUM_SIGNATURE_INVALID',
    );
    expect(
      errorCode(verifySignedManifest(m, { k1: Buffer.alloc(31).toString('base64') }, 1)),
    ).toBe('CURRICULUM_SIGNATURE_INVALID');
  });

  it('rejects formatVersion 2', () => {
    const m = { ...signPayload(GOOD, a.privateKey), formatVersion: 2 };
    expect(errorCode(verifySignedManifest(m, keys, 1))).toBe('CURRICULUM_MANIFEST_INVALID');
  });

  it('rejects an envelope that is not an object', () => {
    expect(errorCode(verifySignedManifest(null, keys, 1))).toBe('CURRICULUM_MANIFEST_INVALID');
    expect(errorCode(verifySignedManifest('x', keys, 1))).toBe('CURRICULUM_MANIFEST_INVALID');
  });

  it('rejects a signed payload with a bad sha256', () => {
    const m = signPayload({ ...GOOD, sha256: 'xyz' }, a.privateKey);
    expect(errorCode(verifySignedManifest(m, keys, 1))).toBe('CURRICULUM_MANIFEST_INVALID');
  });

  it('rejects signed payloads with bad schema, version or size_bytes', () => {
    for (const bad of [
      { schema: 0 },
      { schema: 1.5 },
      { version: 0 },
      { version: '54' },
      { size_bytes: -1 },
      { size_bytes: 1.5 },
      { published_at: 5 },
    ]) {
      const m = signPayload({ ...GOOD, ...bad }, a.privateKey);
      expect(errorCode(verifySignedManifest(m, keys, 1))).toBe('CURRICULUM_MANIFEST_INVALID');
    }
  });

  it('rejects a signed payload that is not JSON', () => {
    const m = signBytes(Buffer.from('not json', 'utf8'), a.privateKey);
    expect(errorCode(verifySignedManifest(m, keys, 1))).toBe('CURRICULUM_MANIFEST_INVALID');
  });

  it('rejects a payload for another schema', () => {
    const m = signPayload({ ...GOOD, schema: 2 }, a.privateKey);
    expect(errorCode(verifySignedManifest(m, keys, 1))).toBe('CURRICULUM_SCHEMA_MISMATCH');
  });

  it('checks the signature before it reads the payload', () => {
    const m = signBytes(Buffer.from('garbage', 'utf8'), a.privateKey);
    const sig = Buffer.from(m.signature, 'base64');
    sig[5] ^= 1;
    m.signature = sig.toString('base64');
    expect(errorCode(verifySignedManifest(m, keys, 1))).toBe('CURRICULUM_SIGNATURE_INVALID');
  });

  it('the bundled keys file has k1 and k2, each 32 bytes', () => {
    for (const id of ['k1', 'k2']) {
      expect(Buffer.from(SIGNING_KEYS[id], 'base64')).toHaveLength(32);
    }
  });
});
