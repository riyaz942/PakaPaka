/**
 * Make an Ed25519 signing key for curriculum releases.
 * Usage: npm run curriculum-keygen -- --out <path>
 * Writes the private key (PKCS#8 PEM, mode 600) to <path>; prints only the public key.
 */
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { publicKeyBase64 } from './curriculum-release';

function main(): void {
  const i = process.argv.indexOf('--out');
  const out = i >= 0 ? process.argv[i + 1] : undefined;
  if (!out) {
    console.error('Usage: npm run curriculum-keygen -- --out <path>');
    process.exit(1);
  }
  if (existsSync(out)) {
    console.error('Refusing: the output file already exists.');
    process.exit(1);
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
  mkdirSync(dirname(out), { recursive: true, mode: 0o700 });
  writeFileSync(out, pem, { mode: 0o600, flag: 'wx' });
  console.log(`Public key: ${publicKeyBase64(publicKey)}`);
}

main();
