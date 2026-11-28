import Database from 'better-sqlite3';
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildPayload,
  checkKeyMatches,
  checkNewerThanLive,
  checkSeedShape,
  encodePayload,
  isSqliteFile,
  publicKeyBase64,
  publicKeyFromBase64,
  resolveReleaseTarget,
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

  it('CURRICULUM_SCHEMA_VERSION is 2', () => {
    expect(CURRICULUM_SCHEMA_VERSION).toBe(2);
  });

  it('isSqliteFile accepts a SQLite header and rejects an LFS pointer', () => {
    expect(isSqliteFile(Buffer.concat([Buffer.from('SQLite format 3\0', 'latin1'), Buffer.alloc(8)]))).toBe(true);
    expect(isSqliteFile(Buffer.from('version https://git-lfs.github.com/spec/v1\n', 'utf8'))).toBe(false);
    expect(isSqliteFile(Buffer.alloc(0))).toBe(false);
  });

  it('checkNewerThanLive: no live ok; older live ok; same or newer live throws', () => {
    expect(() => checkNewerThanLive(54, null)).not.toThrow();
    expect(() => checkNewerThanLive(54, { ...PAYLOAD, version: 53 })).not.toThrow();
    expect(() => checkNewerThanLive(54, { ...PAYLOAD, version: 54 })).toThrow('live version 54 is not older than 54');
    expect(() => checkNewerThanLive(54, { ...PAYLOAD, version: 55 })).toThrow('live version 55 is not older than 54');
  });

  it('checkKeyMatches: right key ok; other key under k1 throws; unknown id throws', () => {
    const a = newKey();
    const b = newKey();
    const keys = { k1: publicKeyBase64(a.publicKey) };
    expect(() => checkKeyMatches(a.privateKey, 'k1', keys)).not.toThrow();
    expect(() => checkKeyMatches(b.privateKey, 'k1', keys)).toThrow('the key file does not match k1');
    expect(() => checkKeyMatches(a.privateKey, 'k9', keys)).toThrow('keyId k9 is not in curriculum-signing-keys.json');
  });

  it('buildPayload uses the schema and an ISO time', () => {
    const now = new Date('2026-11-20T10:11:12.345Z');
    expect(buildPayload({ version: 54, sha256: 'ab'.repeat(32), sizeBytes: 1024 }, 1, now)).toEqual({
      schema: 1,
      version: 54,
      sha256: 'ab'.repeat(32),
      size_bytes: 1024,
      published_at: '2026-11-20T10:11:12.345Z',
    });
  });

  it('resolveReleaseTarget: no flags releases the committed seed under the current schema', () => {
    expect(resolveReleaseTarget([], 2)).toEqual({ schema: 2, seedFile: undefined });
    expect(resolveReleaseTarget(['--schema', '2'], 2)).toEqual({ schema: 2, seedFile: undefined });
  });

  it('resolveReleaseTarget: an older schema needs the file of that schema', () => {
    expect(resolveReleaseTarget(['--schema', '1', '--seed', '/tmp/s1.db'], 2)).toEqual({
      schema: 1,
      seedFile: '/tmp/s1.db',
    });
    expect(() => resolveReleaseTarget(['--schema', '1'], 2)).toThrow('--seed');
  });

  it('resolveReleaseTarget: rejects a bad schema, and --seed under the current schema', () => {
    expect(() => resolveReleaseTarget(['--schema', 'x'], 2)).toThrow('--schema');
    expect(() => resolveReleaseTarget(['--schema', '3'], 2)).toThrow('--schema');
    expect(() => resolveReleaseTarget(['--seed', '/tmp/a.db'], 2)).toThrow('--seed');
  });

  it('resolveReleaseTarget: a flag with no value is an error', () => {
    expect(() => resolveReleaseTarget(['--schema'], 2)).toThrow('--schema needs a value');
    expect(() => resolveReleaseTarget(['--schema', '--dry-run'], 2)).toThrow('--schema needs a value');
    expect(() => resolveReleaseTarget(['--schema', '1', '--seed'], 2)).toThrow('--seed needs a value');
  });

  describe('checkSeedShape', () => {
    const shape1 = ['id', 'item_type', 'jlpt_level', 'slug'];
    const shape2 = ['id', 'item_type', 'level', 'slug'];
    const tables2 = ['items', 'level_jlpt_equivalence'];

    it('accepts each schema with a db of its own shape', () => {
      expect(() => checkSeedShape(1, ['items'], shape1)).not.toThrow();
      expect(() => checkSeedShape(2, tables2, shape2)).not.toThrow();
    });

    it('refuses a schema 2 db under schema 1, and a schema 1 db under schema 2', () => {
      expect(() => checkSeedShape(1, tables2, shape2)).toThrow('not a schema 1 db');
      expect(() => checkSeedShape(2, ['items'], shape1)).toThrow('not a schema 2 db');
    });

    it('refuses a schema 2 db without level_jlpt_equivalence', () => {
      expect(() => checkSeedShape(2, ['items'], shape2)).toThrow('level_jlpt_equivalence');
    });

    it('refuses a db with both columns', () => {
      expect(() => checkSeedShape(1, ['items'], [...shape1, 'level'])).toThrow('not a schema 1 db');
      expect(() => checkSeedShape(2, tables2, [...shape2, 'jlpt_level'])).toThrow('not a schema 2 db');
    });

    it('reads the shape from a real sqlite file', () => {
      const dir = mkdtempSync(join(tmpdir(), 'release-shape-'));
      try {
        const db = new Database(join(dir, 's2.db'));
        db.exec('CREATE TABLE items (id INTEGER, level INTEGER); CREATE TABLE level_jlpt_equivalence (jlpt TEXT)');
        const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
          (r) => r.name,
        );
        const columns = (db.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
        db.close();
        expect(() => checkSeedShape(2, tables, columns)).not.toThrow();
        expect(() => checkSeedShape(1, tables, columns)).toThrow('not a schema 1 db');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
