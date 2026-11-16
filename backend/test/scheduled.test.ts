import { createScheduledController, env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/env";

const DAY = 24 * 3600 * 1000;

async function seedOldToken() {
  await env.DB.prepare(
    "INSERT INTO refresh_tokens (token_hash, user_id, device_id, device_label, created_at, last_used_at, revoked_at) VALUES ('h', 'u', 'd', 'Old', ?, ?, NULL)",
  )
    .bind(Date.now() - 130 * DAY, Date.now() - 130 * DAY)
    .run();
}

const tokenCount = async () =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM refresh_tokens").first<{ n: number }>())!.n;

async function runScheduled(e: Env) {
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException() {} } as ExecutionContext;
  await worker.scheduled!(createScheduledController(), e, ctx);
  await Promise.all(pending);
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM refresh_tokens").run();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("scheduled", () => {
  it("prunes old refresh tokens even when the usage watch fails", async () => {
    await seedOldToken();
    // Misconfigured account id + a failing mailer: the usage watch throws.
    const failingMail = { send: async () => Promise.reject(new Error("mail down")) } as unknown as SendEmail;
    await runScheduled({ ...env, CF_ACCOUNT_ID: "", ALERT_EMAIL: failingMail });
    expect(await tokenCount()).toBe(0);
  });

  it("runs the usage watch even when pruning fails", async () => {
    const sent: unknown[] = [];
    const mail = { send: async (m: unknown) => void sent.push(m) } as unknown as SendEmail;
    const brokenDb = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === "prepare") {
          return () => {
            throw new Error("d1 down");
          };
        }
        const v = Reflect.get(target, prop, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    await runScheduled({ ...env, DB: brokenDb, CF_ACCOUNT_ID: "", ALERT_EMAIL: mail });
    expect(sent).toHaveLength(1);
  });
});
