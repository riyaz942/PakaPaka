// Loaded with require (not import) so `tsc` does not typecheck the library's own .ts source.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sendWorkerResult, invokeWorkerSync } = require('../node_modules/expo-sqlite/web/WorkerChannel') as {
  sendWorkerResult: (args: {
    id: number;
    result: unknown;
    error: Error | null;
    syncTrait: { lockBuffer: SharedArrayBuffer; resultBuffer: SharedArrayBuffer };
  }) => void;
  invokeWorkerSync: (worker: unknown, type: string, data: unknown) => unknown;
};

function syncTrait(initial = 1024 * 1024) {
  return {
    lockBuffer: new SharedArrayBuffer(4),
    resultBuffer: new SharedArrayBuffer(initial, { maxByteLength: 256 * 1024 * 1024 }),
  };
}
function readLength(buf: SharedArrayBuffer) {
  return new Uint32Array(buf, 0, 1)[0];
}

test('writes the full 32-bit length for a result of 300 bytes', () => {
  const trait = syncTrait();
  sendWorkerResult({ id: 1, result: 'x'.repeat(300), error: null, syncTrait: trait });
  expect(readLength(trait.resultBuffer)).toBeGreaterThan(300); // serialized JSON, not length & 0xFF
});

test('grows the result buffer for a 2 MB result', () => {
  const trait = syncTrait();
  sendWorkerResult({ id: 2, result: 'y'.repeat(2 * 1024 * 1024), error: null, syncTrait: trait });
  const length = readLength(trait.resultBuffer);
  expect(length).toBeGreaterThan(2 * 1024 * 1024);
  expect(trait.resultBuffer.byteLength).toBeGreaterThanOrEqual(4 + length);
});

type SyncMessage = {
  id: number;
  lockBuffer: SharedArrayBuffer;
  resultBuffer: SharedArrayBuffer;
};

describe('invokeWorkerSync (main side of the bridge)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('reads a 2 MB result back through the growable buffer', () => {
    const big = 'z'.repeat(2 * 1024 * 1024);
    const worker = {
      postMessage: (message: SyncMessage) =>
        sendWorkerResult({
          id: message.id,
          result: big,
          error: null,
          syncTrait: { lockBuffer: message.lockBuffer, resultBuffer: message.resultBuffer },
        }),
    };

    expect(invokeWorkerSync(worker, 'execSync', {})).toBe(big);
  });

  it('keeps waiting past a million spins and only times out after the 30 s deadline', () => {
    const worker = { postMessage: jest.fn() }; // never answers
    const start = 1_000_000;
    let calls = 0;
    // The first 3000 clock reads fall inside the deadline (more than 1M spins elapse meanwhile); the next is past it.
    jest.spyOn(Date, 'now').mockImplementation(() => {
      calls += 1;
      return calls <= 3000 ? start : start + 30_001;
    });

    expect(() => invokeWorkerSync(worker, 'execSync', {})).toThrow('Sync operation timeout');
    // More than the old 1,000,000-spin limit passed before giving up.
    expect(calls).toBeGreaterThan(3000);
  });
});
