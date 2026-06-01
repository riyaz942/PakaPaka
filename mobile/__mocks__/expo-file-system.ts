import {
  getMockFileStore,
  resetMockFileSystem,
  setMockFileContents,
} from '../test-support/file-system-test-state';

export const documentDirectory = 'file:///mock-documents/';

export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
} as const;

export { resetMockFileSystem as __mockResetFileSystem };
export { setMockFileContents as __mockSetFileContents };

export async function getInfoAsync(uri: string) {
  const files = getMockFileStore();
  return { exists: files.has(uri), uri, isDirectory: uri.endsWith('/') };
}

export async function makeDirectoryAsync(_uri: string, _options?: { intermediates?: boolean }) {
  return;
}

export async function deleteAsync(uri: string, _options?: { idempotent?: boolean }) {
  getMockFileStore().delete(uri);
}

export async function moveAsync(options: { from: string; to: string }) {
  const files = getMockFileStore();
  const contents = files.get(options.from);
  if (contents !== undefined) {
    files.set(options.to, contents);
    files.delete(options.from);
  }

  if (options.to.endsWith('curriculum.db') && !options.to.includes('.download')) {
    const { __mockApplyDownloadedCurriculumToActive } = require('./expo-sqlite') as {
      __mockApplyDownloadedCurriculumToActive: () => void;
    };
    __mockApplyDownloadedCurriculumToActive();
  }
}

export async function copyAsync(options: { from: string; to: string }) {
  const files = getMockFileStore();

  if (options.from.startsWith('file://')) {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const filePath = options.from.replace('file://', '');
    const base64 = readFileSync(filePath).toString('base64');
    files.set(options.to, base64);
    return;
  }

  const contents = files.get(options.from);
  if (contents !== undefined) {
    files.set(options.to, contents);
  }
}

export async function readAsStringAsync(
  uri: string,
  options?: { encoding?: (typeof EncodingType)[keyof typeof EncodingType] },
) {
  const contents = getMockFileStore().get(uri);
  if (contents === undefined) {
    throw new Error(`File not found: ${uri}`);
  }
  if (options?.encoding === EncodingType.Base64) {
    return contents;
  }
  return contents;
}

export async function downloadAsync(uri: string, fileUri: string) {
  const files = getMockFileStore();
  const existing = files.get(uri);
  if (existing === undefined) {
    throw new Error(`Download source not found: ${uri}`);
  }
  files.set(fileUri, existing);
  return { uri: fileUri, status: 200, headers: {}, md5: null };
}
