import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

const publicDir = join(__dirname, '..', 'public');
const headersFile = readFileSync(join(publicDir, '_headers'), 'utf8');
const landingHtml = readFileSync(join(publicDir, 'landing', 'index.html'), 'utf8');

const SPA_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";

// Parse a Cloudflare `_headers` file: a path line, then indented header lines.
function parseRules(text: string): Map<string, string[]> {
  const rules = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (/^\s/.test(line)) {
      current?.push(line.trim());
    } else {
      current = [];
      rules.set(line.trim(), current);
    }
  }
  return rules;
}

function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  const re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    hashes.push(`'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  }
  return hashes;
}

describe('web security headers', () => {
  const rules = parseRules(headersFile);

  it('/* rule has COOP and COEP', () => {
    const lines = rules.get('/*') ?? [];
    expect(lines).toContain('Cross-Origin-Opener-Policy: same-origin');
    expect(lines).toContain('Cross-Origin-Embedder-Policy: require-corp');
  });

  it('one CSP for every path: the landing inline scripts are allowed by hash', () => {
    // Cloudflare's `! Content-Security-Policy` detach did not work for "/" in production
    // (the page got two CSPs, and the stricter one blocked both scripts), so no path
    // rule may add or detach a CSP. A second CSP can only narrow the first.
    expect([...rules.keys()]).toEqual(['/*']);

    const hashes = inlineScriptHashes(landingHtml);
    expect(hashes).toHaveLength(2);

    const lines = rules.get('/*') ?? [];
    expect(lines.filter((l) => l.startsWith('Content-Security-Policy:'))).toEqual([
      `Content-Security-Policy: ${SPA_CSP.replace("'wasm-unsafe-eval'", `'wasm-unsafe-eval' ${hashes.join(' ')}`)}`,
    ]);
    expect(lines.some((l) => l.startsWith('!'))).toBe(false);
  });
});
