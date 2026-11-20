import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  encodePayload,
  publicKeyBase64,
  publicKeyFromBase64,
  signManifest,
  verifyManifest,
  type ManifestPayload,
} from './curriculum-release';
import { CURRICULUM_SCHEMA_VERSION } from './curriculum-schema';

const PAYLOAD: ManifestPayload = {
  schema: 1,
  version: 54,
  sha256: 'ab'.repeat(32),
  size_bytes: 1024,
  published_at: '2026-11-20T00:00:00.000Z',
};

// Ed25519 key from the 32-byte seed 0x01 x 32 (PKCS#8 prefix + seed).
const FIXTURE_SEED = Buffer.alloc(32, 1);
const FIXTURE_KEY = createPrivateKey({
  key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), FIXTURE_SEED]),
  format: 'der',
  type: 'pkcs8',
});
const FIXTURE_PATH = join(__dirname, '__fixtures__', 'curriculum-signed-manifest.json');

function newKey() {
  return generateKeyPairSync('ed25519');
}

function flipByte(b64: string): string {
  const bytes = Buffer.from(b64, 'base64');
  bytes[0] ^= 0x01;
  return bytes.toString('base64');
}

function signRaw(payloadBytes: Buffer, keyId: string, privateKey: ReturnType<typeof newKey>['privateKey']) {
  return {
    format: 'pakapaka-curriculum-manifest',
    formatVersion: 1,
    keyId,
    payload: payloadBytes.toString('base64'),
    signature: sign(null, payloadBytes, privateKey).toString('base64'),
  };
}

describe('curriculum-release', () => {
  it('sign then verify returns the payload', () => {
    const { privateKey, publicKey } = newKey();
    const m = signManifest(PAYLOAD, 'k1', privateKey);
    expect(verifyManifest(m, { k1: publicKeyBase64(publicKey) })).toEqual(PAYLOAD);
  });

  it('encodePayload keeps the key order', () => {
    expect(encodePayload(PAYLOAD).toString('utf8')).toBe(
      `{"schema":1,"version":54,"sha256":"${'ab'.repeat(32)}","size_bytes":1024,"published_at":"2026-11-20T00:00:00.000Z"}`,
    );
  });

  it('verify rejects a manifest with no signature', () => {
    const { privateKey, publicKey } = newKey();
    const { signature: _s, ...rest } = signManifest(PAYLOAD, 'k1', privateKey);
    expect(() => verifyManifest(rest, { k1: publicKeyBase64(publicKey) })).toThrow('bad envelope');
  });

  it('rejects one changed byte in the payload', () => {
    const { privateKey, publicKey } = newKey();
    const m = signManifest(PAYLOAD, 'k1', privateKey);
    expect(() =>
      verifyManifest({ ...m, payload: flipByte(m.payload) }, { k1: publicKeyBase64(publicKey) }),
    ).toThrow('bad signature');
  });

  it('rejects one changed byte in the signature', () => {
    const { privateKey, publicKey } = newKey();
    const m = signManifest(PAYLOAD, 'k1', privateKey);
    expect(() =>
      verifyManifest({ ...m, signature: flipByte(m.signature) }, { k1: publicKeyBase64(publicKey) }),
    ).toThrow('bad signature');
  });

  it('rejects a manifest signed by another key under keyId k1', () => {
    const a = newKey();
    const b = newKey();
    const m = signManifest(PAYLOAD, 'k1', a.privateKey);
    expect(() => verifyManifest(m, { k1: publicKeyBase64(b.publicKey) })).toThrow('bad signature');
  });

  it('rejects an unknown keyId', () => {
    const { privateKey, publicKey } = newKey();
    const m = signManifest(PAYLOAD, 'k9', privateKey);
    expect(() => verifyManifest(m, { k1: publicKeyBase64(publicKey) })).toThrow('unknown key');
  });

  it('rejects format or formatVersion that differ', () => {
    const { privateKey, publicKey } = newKey();
    const keys = { k1: publicKeyBase64(publicKey) };
    const m = signManifest(PAYLOAD, 'k1', privateKey);
    expect(() => verifyManifest({ ...m, format: 'other' }, keys)).toThrow('bad envelope');
    expect(() => verifyManifest({ ...m, formatVersion: 2 }, keys)).toThrow('bad envelope');
  });

  it('rejects a payload that is not JSON', () => {
    const { privateKey, publicKey } = newKey();
    const m = signRaw(Buffer.from('not json at all', 'utf8'), 'k1', privateKey);
    expect(() => verifyManifest(m, { k1: publicKeyBase64(publicKey) })).toThrow('bad payload');
  });

  it('rejects a sha256 that is not 64 lowercase hex', () => {
    const { privateKey, publicKey } = newKey();
    const keys = { k1: publicKeyBase64(publicKey) };
    for (const sha256 of ['AB'.repeat(32), 'ab'.repeat(31), 'zz'.repeat(32)]) {
      const m = signManifest({ ...PAYLOAD, sha256 }, 'k1', privateKey);
      expect(() => verifyManifest(m, keys)).toThrow('bad payload');
    }
  });

  it('rejects a version that is not a positive integer', () => {
    const { privateKey, publicKey } = newKey();
    const keys = { k1: publicKeyBase64(publicKey) };
    for (const version of [0, -1, 1.5, NaN]) {
      const m = signManifest({ ...PAYLOAD, version }, 'k1', privateKey);
      expect(() => verifyManifest(m, keys)).toThrow('bad payload');
    }
  });

  it('publicKeyBase64 round-trips through publicKeyFromBase64', () => {
    const { publicKey } = newKey();
    const b64 = publicKeyBase64(publicKey);
    expect(Buffer.from(b64, 'base64')).toHaveLength(32);
    expect(publicKeyBase64(publicKeyFromBase64(b64))).toBe(b64);
  });

  it('the committed fixture equals signManifest(FIXTURE_PAYLOAD, test, FIXTURE_KEY)', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
    const expectedPublic = publicKeyBase64(FIXTURE_KEY);
    expect(fixture._testPublicKey).toBe(expectedPublic);
    const { _testPublicKey: _p, ...manifest } = fixture;
    expect(manifest).toEqual(signManifest(PAYLOAD, 'test', FIXTURE_KEY));
    expect(verifyManifest(fixture, { test: expectedPublic })).toEqual(PAYLOAD);
  });

  it('CURRICULUM_SCHEMA_VERSION is 1', () => {
    expect(CURRICULUM_SCHEMA_VERSION).toBe(1);
  });
});
