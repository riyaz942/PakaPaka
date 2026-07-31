#!/usr/bin/env node
/**
 * Regenerates src/utils/radicalImages.ts from the art committed under
 * assets/radicals/{level}/{slug}.webp.
 *
 * Metro cannot require() a path built at runtime, so every bundled image needs a
 * literal require in a checked-in file. Run this after adding or removing art.
 */

const fs = require('node:fs');
const path = require('node:path');

const MOBILE_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(MOBILE_ROOT, 'assets', 'radicals');
const OUTPUT_FILE = path.join(MOBILE_ROOT, 'src', 'utils', 'radicalImages.ts');

const LEVEL_PATTERN = /^n[1-5]$/;
const FILE_PATTERN = /^[a-z0-9-]+\.webp$/;

function collectImages() {
  const refs = [];
  const rejected = [];

  for (const level of fs.readdirSync(ASSETS_DIR).sort()) {
    const levelDir = path.join(ASSETS_DIR, level);
    if (!fs.statSync(levelDir).isDirectory()) {
      if (level !== '.gitkeep') rejected.push(level);
      continue;
    }
    if (!LEVEL_PATTERN.test(level)) {
      rejected.push(`${level}/`);
      continue;
    }

    for (const file of fs.readdirSync(levelDir).sort()) {
      if (file === '.gitkeep') continue;
      if (!FILE_PATTERN.test(file)) {
        rejected.push(`${level}/${file}`);
        continue;
      }
      refs.push(`radicals/${level}/${file}`);
    }
  }

  return { refs, rejected };
}

const { refs, rejected } = collectImages();

if (rejected.length > 0) {
  console.error(
    'Unexpected entries under assets/radicals/ (expected {n1-n5}/{slug}.webp):\n' +
      rejected.map((entry) => `  ${entry}`).join('\n') +
      '\nConvert art to WebP (≤80 KB) and name it after the curriculum slug.',
  );
  process.exit(1);
}

const entries = refs.map((ref) => `  '${ref}': require('../../assets/${ref}'),`).join('\n');

// Only emitted alongside real requires; an unused directive is itself a warning.
const eslintHeader = entries
  ? `/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves bundled
   assets only through literal require() calls. */\n`
  : '';

const contents = `${eslintHeader}// GENERATED FILE — do not edit by hand.
// Run \`npm run generate-radical-assets\` after adding or removing art under
// \`assets/radicals/\`. See docs/content/radical-mnemonic-images.md.

import type { ImageSourcePropType } from 'react-native';

/**
 * Radical mnemonic art bundled into the app binary, keyed by the value the
 * curriculum stores in \`visual_mnemonic_url\` (\`radicals/{level}/{slug}.webp\`).
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
