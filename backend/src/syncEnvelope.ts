const ENVELOPE =
  /^\{"format":"pakapaka-backup","formatVersion":1,"schemaVersion":\d+,"curriculumVersion":(null|"[^"]*"),"exportedAt":"[^"]*","includesConversations":false,"data":\{/;

const HEAD_BYTES = 4096;

// Checks the envelope at the start of a gzipped sync file. Inflates only the first 4096 compressed bytes
// and reads only the first output chunk. The input is a cut-off slice, so the writer is never closed;
// both sides are cancelled after the first chunk.
export async function checkSyncEnvelope(bytes: Uint8Array): Promise<boolean> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  try {
    writer.write(bytes.subarray(0, HEAD_BYTES)).catch(() => {});
    const { value } = await reader.read();
    if (!value) return false;
    return ENVELOPE.test(new TextDecoder().decode(value));
  } catch {
    return false;
  } finally {
    reader.cancel().catch(() => {});
    writer.abort().catch(() => {});
  }
}
