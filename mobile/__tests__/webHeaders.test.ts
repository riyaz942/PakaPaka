import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

const publicDir = join(__dirname, '..', 'public');
const headersFile = readFileSync(join(publicDir, '_headers'), 'utf8');
const landingHtml = readFileSync(join(publicDir, 'landing', 'index.html'), 'utf8');

const SPA_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";

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

  it('/* rule has the SPA CSP', () => {
    const lines = rules.get('/*') ?? [];
    expect(lines).toContain(`Content-Security-Policy: ${SPA_CSP}`);
    expect(lines).toContain('Cross-Origin-Opener-Policy: same-origin');
    expect(lines).toContain('Cross-Origin-Embedder-Policy: require-corp');
  });

  it('landing rules detach the SPA CSP and allow each inline script by hash', () => {
    const hashes = inlineScriptHashes(landingHtml);
    expect(hashes).toHaveLength(2);

    for (const path of ['/', '/landing/*']) {
      const lines = rules.get(path) ?? [];
      expect(lines).toContain('! Content-Security-Policy');

      const csp = lines.find((l) => l.startsWith('Content-Security-Policy:'));
      expect(csp).toBeDefined();
      const scriptSrc = /script-src ([^;]*)/.exec(csp as string)?.[1] ?? '';
      for (const hash of hashes) expect(scriptSrc).toContain(hash);
      expect(scriptSrc).not.toContain('unsafe-inline');
      expect(scriptSrc).not.toContain('unsafe-eval');
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");

      // COOP/COEP come from the /* rule; repeating them here would join the values.
      expect(lines.some((l) => l.startsWith('Cross-Origin-'))).toBe(false);
    }
  });
});
