const REVOKE_DELAY_MS = 40_000;

/** Triggers a browser download of the backup. There is no file URI on web. */
export async function saveBackupFile(fileName: string, base64Contents: string): Promise<string | null> {
  const binary = globalThis.atob(base64Contents);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/gzip' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // Safari may ask permission before it starts the download; revoking at once can fail it.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  return null;
}

/** Reads a picked file (a `blob:` URI from the document picker) as base64. */
export async function readBackupFile(fileUri: string): Promise<string> {
  const response = await fetch(fileUri);
  if (!response.ok) {
    throw new Error(`Could not read ${fileUri}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}
