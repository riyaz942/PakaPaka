#!/usr/bin/env node
/**
 * Regenerates src/utils/radicalImages.ts from the art committed under
 * assets/radicals/{source}/{slug}.webp, where {source} is the dataset that
 * wrote the radical (n5/n4 for the hand-authored lists, k for the derived
 * corpus) — not its band, which moves.
 *
 * Metro cannot require() a path built at runtime, so every bundled image needs a
 * literal require in a checked-in file. Run this after adding or removing art.
 */

const fs = require('node:fs');
const path = require('node:path');

const MOBILE_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(MOBILE_ROOT, 'assets', 'radicals');
const OUTPUT_FILE = path.join(MOBILE_ROOT, 'src', 'utils', 'radicalImages.ts');

const SOURCE_PATTERN = /^(n[1-5]|k)$/;
const FILE_PATTERN = /^[a-z0-9-]+\.webp$/;
const MAX_BYTES = 80 * 1024;

function collectImages() {
  const refs = [];
  const rejected = [];
  const oversize = [];

  for (const source of fs.readdirSync(ASSETS_DIR).sort()) {
    const sourceDir = path.join(ASSETS_DIR, source);
    if (!fs.statSync(sourceDir).isDirectory()) {
      if (source !== '.gitkeep') rejected.push(source);
      continue;
    }
    if (!SOURCE_PATTERN.test(source)) {
      rejected.push(`${source}/`);
      continue;
    }

    for (const file of fs.readdirSync(sourceDir).sort()) {
      if (file === '.gitkeep') continue;
      if (!FILE_PATTERN.test(file)) {
        rejected.push(`${source}/${file}`);
        continue;
      }
      const bytes = fs.statSync(path.join(sourceDir, file)).size;
      if (bytes > MAX_BYTES) {
        oversize.push(`${source}/${file} (${Math.round(bytes / 1024)} KB)`);
        continue;
      }
      refs.push(`radicals/${source}/${file}`);
    }
  }

  return { refs, rejected, oversize };
}

const { refs, rejected, oversize } = collectImages();

if (rejected.length > 0) {
  console.error(
    'Unexpected entries under assets/radicals/ (expected {n1-n5,k}/{slug}.webp):\n' +
      rejected.map((entry) => `  ${entry}`).join('\n') +
      '\nConvert art to WebP (≤80 KB) and name it after the curriculum slug.',
  );
  process.exit(1);
}

if (oversize.length > 0) {
  console.error(
    `Radical art over the ${MAX_BYTES / 1024} KB budget:\n` +
      oversize.map((entry) => `  ${entry}`).join('\n') +
      '\nRecompress (see docs/workflows/radical-art-web-chat-workflow.md) before committing.',
  );
  process.exit(1);
}

const entries = refs.map((ref) => `  '${ref}': require('../../assets/${ref}'),`).join('\n');

const contents = `// GENERATED FILE — do not edit by hand.
// Run \`npm run generate-radical-assets\` after adding or removing art under
// \`assets/radicals/\`. See docs/content/radical-mnemonic-images.md.

import type { ImageSourcePropType } from 'react-native';

/**
 * Radical mnemonic art bundled into the app binary, keyed by the value the
 * curriculum stores in \`visual_mnemonic_url\` (\`radicals/{source}/{slug}.webp\`,
 * keyed by the dataset that wrote the radical, not by its band).
 * There is no remote image host, so a key missing here means that radical's art
 * has not been drawn yet and the caller renders the mnemonic text instead.
 */
const RADICAL_IMAGES: Record<string, ImageSourcePropType> = {${
  entries ? `\n${entries}\n` : ''
}};

export function getRadicalImage(ref: string | null | undefined): ImageSourcePropType | undefined {
  const key = ref?.trim();
  return key ? RADICAL_IMAGES[key] : undefined;
}
`;

fs.writeFileSync(OUTPUT_FILE, contents);
console.log(`Wrote ${path.relative(MOBILE_ROOT, OUTPUT_FILE)} with ${refs.length} image(s).`);
