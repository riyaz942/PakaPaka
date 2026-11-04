import { readBackupFile, saveBackupFile } from './backupFile.web';

describe('backupFile.web', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('reads a picked blob: file as base64', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0x1f, 0x8b, 0x08]).buffer,
    }) as unknown as typeof fetch;

    await expect(readBackupFile('blob:x')).resolves.toBe('H4sI');
    expect(global.fetch).toHaveBeenCalledWith('blob:x');
  });

  it('downloads the backup through an anchor and returns no file URI', async () => {
    const anchor = { href: '', download: '', click: jest.fn() };
    const createElement = jest.fn().mockReturnValue(anchor);
    Object.defineProperty(globalThis, 'document', {
      value: { createElement },
      configurable: true,
    });
    const createObjectURL = jest.fn().mockReturnValue('blob:backup');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(globalThis, 'URL', {
      value: Object.assign(function URL() {}, { createObjectURL, revokeObjectURL }),
      configurable: true,
    });

    jest.useFakeTimers();
    const uri = await saveBackupFile('kizamu-backup-1.json.gz', 'H4sI');

    expect(uri).toBeNull();
    expect(createElement).toHaveBeenCalledWith('a');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchor.download).toBe('kizamu-backup-1.json.gz');
    expect(anchor.href).toBe('blob:backup');
    expect(anchor.click).toHaveBeenCalledTimes(1);
    // Safari can start the download late (permission prompt): keep the URL valid for a while.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    jest.advanceTimersByTime(60_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup');
  });
});
