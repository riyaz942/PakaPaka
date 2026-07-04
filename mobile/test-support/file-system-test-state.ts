const files = new Map<string, string>();
let curriculumFixtureBase64: string | undefined;
let onCurriculumSwap: (() => void) | undefined;

export function resetMockFileSystem() {
  files.clear();
  curriculumFixtureBase64 = undefined;
  onCurriculumSwap = undefined;
}

export function setMockFileContents(uri: string, base64Contents: string) {
  files.set(uri, base64Contents);
}

export function getMockFileContents(uri: string): string | undefined {
  return files.get(uri);
}

export function getMockFileStore() {
  return files;
}

export function setMockCurriculumFixtureBase64(base64Contents: string) {
  curriculumFixtureBase64 = base64Contents;
}

export function getMockCurriculumFixtureBase64(): string | undefined {
  return curriculumFixtureBase64;
}

export function setMockCurriculumSwapCallback(callback: () => void) {
  onCurriculumSwap = callback;
}

export function applyMockCurriculumSwap(downloadUri: string, finalUri: string): void {
  const downloaded = files.get(downloadUri);
  if (downloaded) {
    files.set(finalUri, downloaded);
    files.delete(downloadUri);
  }
  onCurriculumSwap?.();
}
