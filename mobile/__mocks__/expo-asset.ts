import { readFileSync } from 'node:fs';
import path from 'node:path';

const FIXTURE_PATH = path.join(
  __dirname,
  '..',
  'assets',
  'curriculum-manifest',
  'curriculum-mock-update.db',
);

export class Asset {
  localUri: string | null = `file://${FIXTURE_PATH}`;

  static fromModule(_moduleId: number) {
    return new Asset();
  }

  async downloadAsync() {
    return;
  }
}

export function __mockGetFixturePath() {
  return FIXTURE_PATH;
}
