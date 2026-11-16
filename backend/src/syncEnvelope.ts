const ENVELOPE =
  /^\{"format":"pakapaka-backup","formatVersion":1,"schemaVersion":\d+,"curriculumVersion":(null|"[^"]*"),"exportedAt":"[^"]*","includesConversations":false,"data":\{/;

const HEAD_BYTES = 4096;

// Checks the envelope at the start of a gzipped sync file. Inflates only the first 4096 compressed bytes
// and reads only the first output chunk. The read starts before the write and close, so it gets the first
// chunk; the "incomplete data" error of closing a cut-off slice only rejects later reads. Input with no
// output (a gzip header only) rejects the read instead of waiting forever.
export async function checkSyncEnvelope(bytes: Uint8Array): Promise<boolean> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  const first = reader.read();
  writer.write(bytes.subarray(0, HEAD_BYTES)).catch(() => {});
  writer.close().catch(() => {});
  try {
    const { value } = await first;
    if (!value) return false;
    return ENVELOPE.test(new TextDecoder().decode(value));
  } catch {
    return false;
  } finally {
    reader.cancel().catch(() => {});
    writer.abort().catch(() => {});
  }
}
