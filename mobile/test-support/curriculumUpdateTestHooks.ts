import { readFileSync } from 'node:fs';
import path from 'node:path';

import { getMockFileStore, setMockFileContents } from './file-system-test-state';

import { __mockApplyDownloadedCurriculumToActive } from '../__mocks__/expo-sqlite';

const FIXTURE_DB_PATH = path.join(
  __dirname,
  '../assets/curriculum-manifest/curriculum-mock-update.db',
);

export function seedMockDownloadedCurriculum(tempUri: string): void {
  setMockFileContents(tempUri, readFileSync(FIXTURE_DB_PATH).toString('base64'));
}

export function applyMockCurriculumSwap(downloadUri: string, finalUri: string): void {
  const files = getMockFileStore();
  const downloaded = files.get(downloadUri);
  if (downloaded) {
    files.set(finalUri, downloaded);
    files.delete(downloadUri);
  }
  __mockApplyDownloadedCurriculumToActive();
}
