import {
  documentDirectory,
  EncodingType,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

const TEST_DOCUMENT_DIRECTORY = 'file:///mock-documents/';

/**
 * `jest-expo`'s setup stubs `expo-file-system/legacy` with stateless
 * `jest.fn()`s that shadow this project's own `__mocks__/expo-file-system.ts`
 * for this exact import path — `documentDirectory` and a working
 * `writeAsStringAsync` are unavailable under test. Same workaround as
 * `curriculumConfig.ts`'s `getDocumentDirectory` and
 * `curriculumUpdate.ts`'s `readFileAsBase64`: branch to the shared
 * `test-support/file-system-test-state` store in test mode.
 */
function resolveDocumentDirectory(): string {
  const directory = process.env.NODE_ENV === 'test' ? TEST_DOCUMENT_DIRECTORY : documentDirectory;
  if (!directory) {
    throw new Error('documentDirectory is unavailable');
  }
  return directory;
}

/** Writes the backup to the document directory and returns its `file://` URI. */
export async function saveBackupFile(fileName: string, base64Contents: string): Promise<string | null> {
  const fileUri = `${resolveDocumentDirectory()}${fileName}`;
  if (process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-only file store
    const { setMockFileContents } = require('../../../test-support/file-system-test-state') as {
      setMockFileContents: (uri: string, base64Contents: string) => void;
    };
    setMockFileContents(fileUri, base64Contents);
    return fileUri;
  }
  await writeAsStringAsync(fileUri, base64Contents, { encoding: EncodingType.Base64 });
  return fileUri;
}

/** Returns the file's bytes as base64. */
export async function readBackupFile(fileUri: string): Promise<string> {
  if (process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-only file store
    const { getMockFileContents } = require('../../../test-support/file-system-test-state') as {
      getMockFileContents: (uri: string) => string | undefined;
    };
    const contents = getMockFileContents(fileUri);
    if (contents === undefined) {
      throw new Error(`No file at ${fileUri}`);
    }
    return contents;
  }
  return readAsStringAsync(fileUri, { encoding: EncodingType.Base64 });
}
