import { requestPersistentStorage } from './requestPersistentStorage.web';

function setStorage(storage: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { storage },
    configurable: true,
  });
}

describe('requestPersistentStorage (web)', () => {
  it("returns 'unsupported' when the browser has no storage manager", async () => {
    setStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toBe('unsupported');
  });

  it("returns 'granted' without asking again when storage is already persisted", async () => {
    const persist = jest.fn();
    setStorage({ persisted: jest.fn().mockResolvedValue(true), persist });
    await expect(requestPersistentStorage()).resolves.toBe('granted');
    expect(persist).not.toHaveBeenCalled();
  });

  it("returns 'denied' when the browser refuses the request", async () => {
    setStorage({
      persisted: jest.fn().mockResolvedValue(false),
      persist: jest.fn().mockResolvedValue(false),
    });
    await expect(requestPersistentStorage()).resolves.toBe('denied');
  });

  it("returns 'granted' when the browser accepts the request", async () => {
    setStorage({
      persisted: jest.fn().mockResolvedValue(false),
      persist: jest.fn().mockResolvedValue(true),
    });
    await expect(requestPersistentStorage()).resolves.toBe('granted');
  });

  it("never throws: a rejecting browser API reports 'unsupported'", async () => {
    setStorage({
      persisted: jest.fn().mockRejectedValue(new Error('SecurityError')),
      persist: jest.fn(),
    });
    await expect(requestPersistentStorage()).resolves.toBe('unsupported');
  });
});
