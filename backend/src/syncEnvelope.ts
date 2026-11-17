const ENVELOPE =
  /^\{"format":"pakapaka-backup","formatVersion":1,"schemaVersion":\d+,"curriculumVersion":(null|"[^"]*"),"exportedAt":"[^"]*","includesConversations":false,"data":\{/;

const PIECE_BYTES = 4096;

// Checks the envelope at the start of a gzipped sync file. Feeds the upload in 4096-byte pieces, gives the
// stream a turn after each piece, and stops at the first output chunk, so only the start is ever inflated.
// Closes only when every byte is in: on the deployed runtime, a close on a cut-off slice rejects the first
// read as well (seen 2026-11-17 with `wrangler dev --remote`; the local test runtime still returns it).
// Input with no output (a gzip header only) rejects the read at that close instead of waiting forever.
export async function checkSyncEnvelope(bytes: Uint8Array): Promise<boolean> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  let settled = false;
  const first = reader.read();
  first.then(
    () => (settled = true),
    () => (settled = true),
  );
  try {
    for (let start = 0; start < bytes.byteLength && !settled; start += PIECE_BYTES) {
      writer.write(bytes.subarray(start, start + PIECE_BYTES)).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (!settled) writer.close().catch(() => {});
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
