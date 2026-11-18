import { describe, expect, it } from "vitest";
import { checkSyncEnvelope } from "../src/syncEnvelope";

const HEAD =
  '{"format":"pakapaka-backup","formatVersion":1,"schemaVersion":22,"curriculumVersion":"1.4.0",' +
  '"exportedAt":"2026-11-17T00:00:00.000Z","includesConversations":false,"data":{';

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("checkSyncEnvelope", () => {
  it("valid prefix → true", async () => {
    expect(await checkSyncEnvelope(await gzip(`${HEAD}"srsStates":[]}}`))).toBe(true);
    const nullVersion = HEAD.replace('"1.4.0"', "null");
    expect(await checkSyncEnvelope(await gzip(`${nullVersion}}}`))).toBe(true);
  });

  it("includesConversations true → false", async () => {
    const text = HEAD.replace('"includesConversations":false', '"includesConversations":true');
    expect(await checkSyncEnvelope(await gzip(`${text}}}`))).toBe(false);
  });

  it("formatVersion 2 → false", async () => {
    const text = HEAD.replace('"formatVersion":1', '"formatVersion":2');
    expect(await checkSyncEnvelope(await gzip(`${text}}}`))).toBe(false);
  });

  it("other JSON → false", async () => {
    expect(await checkSyncEnvelope(await gzip('{"hello":"world"}'))).toBe(false);
  });

  it("garbage after the first 4096 bytes still → true", async () => {
    // Random hex compresses poorly, so the gzip is far larger than 4096 bytes.
    const filler = Array.from(crypto.getRandomValues(new Uint8Array(20_000)), (b) => b.toString(16).padStart(2, "0")).join("");
    const full = await gzip(`${HEAD}"filler":"${filler}"}}`);
    expect(full.byteLength).toBeGreaterThan(8192);
    const damaged = new Uint8Array(full.byteLength);
    damaged.set(full.subarray(0, 4096));
    damaged.fill(0xff, 4096);
    expect(await checkSyncEnvelope(damaged)).toBe(true);
  });

  it("gzip header only → false", async () => {
    expect(await checkSyncEnvelope(new Uint8Array([0x1f, 0x8b]))).toBe(false);
    expect(await checkSyncEnvelope(new Uint8Array([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 3]))).toBe(false);
  });

  it("gzip of 10 bytes → false", async () => {
    expect(await checkSyncEnvelope(await gzip("0123456789"))).toBe(false);
  });
});
