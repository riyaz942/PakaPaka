const files = new Map<string, string>();

export function resetMockFileSystem() {
  files.clear();
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
