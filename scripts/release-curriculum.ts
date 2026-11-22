/**
 * Release the bundled curriculum seed: sign the manifest offline, upload to R2.
 * Usage: CURRICULUM_SIGNING_KEY_FILE=<pem> npm run release-curriculum -- --key-id <id> [--dry-run]
 *   Old store apps (content fix): add --schema <n> --seed <db compiled for schema n>.
 * Any failure prints one line and exits 1. The key file contents are never printed.
 * Nothing is ever deleted from R2.
 */
import Database from 'better-sqlite3';
import { createHash, createPrivateKey, type KeyObject } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  buildPayload,
  checkKeyMatches,
  checkNewerThanLive,
  checkSeedShape,
  isSqliteFile,
  readSigningKeys,
  resolveReleaseTarget,
  signManifest,
  verifyManifest,
  type ManifestPayload,
} from './curriculum-release';
import { CURRICULUM_SCHEMA_VERSION } from './curriculum-schema';

const BASE_URL = 'https://paka-paka.app';
const BUCKET = 'pakapaka-curriculum';
const SEED_DIR = 'mobile/assets/curriculum-seed';
const SEED_DB = join(SEED_DIR, 'curriculum.db');

const repoRoot = resolve(__dirname, '..');

function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function fetchLiveManifest(keys: Record<string, string>, schema: number): Promise<ManifestPayload | null> {
  const url = `${BASE_URL}/api/curriculum/s${schema}/manifest.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error(`The live manifest request returned status ${res.status}.`);
  try {
    return verifyManifest(await res.json(), keys);
  } catch (e) {
    throw new Error(`The live manifest does not verify: ${(e as Error).message}`);
  }
}

function put(key: string, file: string, contentType: string): void {
  execFileSync(
    'npx',
    ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file, '--content-type', contentType, '--remote'],
    { cwd: join(repoRoot, 'backend'), stdio: 'inherit' },
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const ki = args.indexOf('--key-id');
  const keyId = ki >= 0 ? args[ki + 1] : undefined;
  const keyFile = process.env.CURRICULUM_SIGNING_KEY_FILE;
  if (!keyId || !keyFile) {
    throw new Error('Usage: CURRICULUM_SIGNING_KEY_FILE=<pem> npm run release-curriculum -- --key-id <id> [--dry-run] [--schema <n> --seed <file>]');
  }
  const { schema, seedFile } = resolveReleaseTarget(args, CURRICULUM_SCHEMA_VERSION);

  // 1. The seed is committed (an older-schema file is not the seed).
  if (seedFile === undefined) {
    const dirty = execFileSync('git', ['status', '--porcelain', '--', SEED_DIR], { cwd: repoRoot, encoding: 'utf8' });
    if (dirty.trim() !== '') throw new Error(`The seed has uncommitted changes. Commit ${SEED_DIR} first.`);
  }

  // 2. The file is a real SQLite file.
  const seedPath = seedFile === undefined ? join(repoRoot, SEED_DB) : resolve(seedFile);
  const fd = openSync(seedPath, 'r');
  const head = Buffer.alloc(16);
  try {
    readSync(fd, head, 0, 16, 0);
  } finally {
    closeSync(fd);
  }
  if (!isSqliteFile(head)) throw new Error('Run git lfs pull first.');

  // 3. Shape, version, SHA-256 and size (before any network or signing step).
  const db = new Database(seedPath, { readonly: true });
  let version: unknown;
  try {
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (row) => row.name,
    );
    const itemColumns = (db.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
    checkSeedShape(schema, tables, itemColumns);
    version = (db.prepare('SELECT version FROM curriculum_metadata').get() as { version: unknown } | undefined)?.version;
  } finally {
    db.close();
  }
  const versionNumber = typeof version === 'string' && /^[0-9]+$/.test(version) ? Number(version) : version;
  if (typeof versionNumber !== 'number' || !Number.isInteger(versionNumber) || versionNumber < 1) {
    throw new Error('The seed curriculum_metadata.version is not a whole number.');
  }
  const bytes = readFileSync(seedPath);
  const sha256 = sha256Hex(bytes);
  const sizeBytes = bytes.length;

  // 4. The live manifest.
  const keys = readSigningKeys(repoRoot);
  const live = await fetchLiveManifest(keys, schema);
  checkNewerThanLive(versionNumber, live);

  // 5. Sign and self-check.
  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey(readFileSync(keyFile));
  } catch {
    throw new Error('Cannot read the key file.');
  }
  checkKeyMatches(privateKey, keyId, keys);
  const payload = buildPayload({ version: versionNumber, sha256, sizeBytes }, schema, new Date());
  const manifest = signManifest(payload, keyId, privateKey);
  verifyManifest(manifest, keys);

  // 6. Write the manifest and print the plan.
  const manifestPath = join(mkdtempSync(join(tmpdir(), 'pakapaka-release-')), 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const fileKey = `files/${sha256}.db`;
  const manifestKey = `s${schema}/manifest.json`;
  console.log(`version ${versionNumber}`);
  console.log(`sha256 ${sha256}`);
  console.log(`size ${sizeBytes} bytes`);
  console.log(`keyId ${keyId}`);
  console.log(
    `cd backend && npx wrangler r2 object put ${BUCKET}/${fileKey} --file ${seedPath} --content-type application/vnd.sqlite3 --remote`,
  );
  console.log(
    `cd backend && npx wrangler r2 object put ${BUCKET}/${manifestKey} --file ${manifestPath} --content-type application/json --remote`,
  );

  // 7. Dry run stops here.
  if (dryRun) {
    console.log('Dry run: nothing uploaded.');
    return;
  }

  // 8. Upload: the file first, then the manifest.
  put(fileKey, seedPath, 'application/vnd.sqlite3');
  put(manifestKey, manifestPath, 'application/json');

  // 9. Live check. The upload is done, so every failure here says so.
  try {
    const after = await fetchLiveManifest(keys, schema);
    if (!after) throw new Error('the live manifest answers 404');
    if (after.version !== versionNumber) throw new Error(`the live version is ${after.version}, not ${versionNumber}`);
    if (after.sha256 !== sha256) throw new Error('the live manifest sha256 does not match');
    if (after.size_bytes !== sizeBytes) throw new Error('the live manifest size does not match');
    const fileRes = await fetch(`${BASE_URL}/api/curriculum/${fileKey}`, { cache: 'no-store' });
    if (fileRes.status !== 200) throw new Error(`the live file request returned status ${fileRes.status}`);
    if (sha256Hex(Buffer.from(await fileRes.arrayBuffer())) !== sha256) {
      throw new Error('the live file SHA-256 does not match');
    }
  } catch (e) {
    throw new Error(`Uploaded, but the live check failed: ${(e as Error).message}`);
  }
  console.log(`Release ${versionNumber} is live.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
