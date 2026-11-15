import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import type { Deps } from "../src/deps";
import type { Env } from "../src/env";
import { FREE_LIMITS, evaluateUsage, fetchUsage, runUsageWatch, type UsageSnapshot } from "../src/usage";
import fixture from "./fixtures/usage-graphql.json";

const nowMs = Date.UTC(2026, 10, 15, 1, 0, 0); // cron time; yesterday = 2026-11-14

const low: UsageSnapshot = {
  workersRequestsPerDay: 0,
  d1ReadsPerDay: 0,
  d1WritesPerDay: 0,
  d1StorageBytes: 0,
  r2ClassAPerMonth: 0,
  r2ClassBPerMonth: 0,
  r2StorageBytes: 0,
};

function makeDeps(respond: (req: Request) => Response | Promise<Response>): { deps: Deps; calls: Request[] } {
  const calls: Request[] = [];
  const deps: Deps = {
    now: () => nowMs,
    fetch: async (input, init) => {
      const req = new Request(input, init);
      calls.push(req);
      return respond(req);
    },
    googleJwks: (() => {
      throw new Error("unused");
    }) as unknown as Deps["googleJwks"],
  };
  return { deps, calls };
}

type Sent = { from: string; to: string; raw: string };

// A workerd EmailMessage hides its raw text, so tests inject a message factory that keeps it.
function makeEnv(): { env: Env; sent: Sent[]; makeMessage: (from: string, to: string, raw: string) => EmailMessage } {
  const sent: Sent[] = [];
  const ALERT_EMAIL = {
    send: async (msg: unknown) => {
      sent.push(msg as Sent);
    },
  } as unknown as SendEmail;
  const makeMessage = (from: string, to: string, raw: string) => ({ from, to, raw }) as unknown as EmailMessage;
  return { env: { ...env, ALERT_EMAIL }, sent, makeMessage };
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function withWorkersRequests(requests: number) {
  const copy = structuredClone(fixture);
  copy.data.viewer.accounts[0].workersInvocationsAdaptive[0].sum.requests = requests;
  return copy;
}

describe("FREE_LIMITS", () => {
  it("D1 storage limit is the 500 MB per-database limit", () => {
    expect(FREE_LIMITS.d1StorageBytes).toBe(500_000_000);
  });
});

describe("evaluateUsage", () => {
  it("flags exactly the metrics at or above 70%", () => {
    const snap: UsageSnapshot = {
      ...low,
      workersRequestsPerDay: 70_000, // exactly 70%
      d1ReadsPerDay: 3_000_000, // 60%
      d1WritesPerDay: 99_000, // 99%
      r2StorageBytes: 7e9, // 70%
      r2ClassAPerMonth: 699_999, // just under
    };
    expect(evaluateUsage(snap)).toEqual([
      { metric: "workersRequestsPerDay", used: 70_000, limit: FREE_LIMITS.workersRequestsPerDay },
      { metric: "d1WritesPerDay", used: 99_000, limit: FREE_LIMITS.d1WritesPerDay },
      { metric: "r2StorageBytes", used: 7e9, limit: FREE_LIMITS.r2StorageBytes },
    ]);
  });

  it("returns [] under threshold", () => {
    expect(evaluateUsage({ ...low, workersRequestsPerDay: 69_999, d1StorageBytes: 349_999_999 })).toEqual([]);
  });

  it("flags D1 storage at 70% of 500 MB", () => {
    expect(evaluateUsage({ ...low, d1StorageBytes: 350_000_000 })).toEqual([
      { metric: "d1StorageBytes", used: 350_000_000, limit: 500_000_000 },
    ]);
  });
});

describe("fetchUsage", () => {
  it("parses the fixture into a snapshot", async () => {
    const { deps, calls } = makeDeps(() => ok(fixture));
    const result = await fetchUsage(env, deps, "2026-11-14");
    expect(result).toEqual({
      ok: true,
      value: {
        workersRequestsPerDay: 1234,
        d1ReadsPerDay: 20000,
        d1WritesPerDay: 800,
        d1StorageBytes: 1_200_000,
        r2ClassAPerMonth: 361, // everything not Class B: PutObject + ListObjects + DeleteObject (over-counted on purpose)
        r2ClassBPerMonth: 5180, // GetObject + HeadObject
        r2StorageBytes: 4_001_000, // payload + metadata
      },
    });
    expect(calls).toHaveLength(1);
    const req = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.cloudflare.com/client/v4/graphql");
    expect(req.headers.get("authorization")).toBe("Bearer test-analytics-token");
    const body = (await req.json()) as { query: string; variables: Record<string, string> };
    for (const dataset of [
      "workersInvocationsAdaptive",
      "d1AnalyticsAdaptiveGroups",
      "d1StorageAdaptiveGroups",
      "r2OperationsAdaptiveGroups",
      "r2StorageAdaptiveGroups",
    ]) {
      expect(body.query).toContain(dataset);
    }
    expect(body.query).toContain("accounts(filter: { accountTag: $accountTag })");
    expect(body.variables).toEqual({
      accountTag: "test-account",
      day: "2026-11-14",
      dayStart: "2026-11-14T00:00:00Z",
      dayEnd: "2026-11-14T23:59:59Z",
      monthStart: "2026-11-01T00:00:00Z",
    });
  });

  it("non-200 → usage_fetch_failed", async () => {
    const { deps } = makeDeps(() => new Response("nope", { status: 401 }));
    expect(await fetchUsage(env, deps, "2026-11-14")).toMatchObject({
      ok: false,
      error: "usage_fetch_failed",
      reason: "http_401",
    });
  });

  it("GraphQL errors → usage_fetch_failed", async () => {
    const { deps } = makeDeps(() => ok({ data: null, errors: [{ message: "secret detail" }] }));
    expect(await fetchUsage(env, deps, "2026-11-14")).toMatchObject({ ok: false, reason: "graphql_errors" });
  });

  it("network error → usage_fetch_failed", async () => {
    const { deps } = makeDeps(() => {
      throw new Error("boom");
    });
    expect(await fetchUsage(env, deps, "2026-11-14")).toMatchObject({ ok: false, reason: "network" });
  });

  it("unexpected response shape → usage_fetch_failed", async () => {
    const { deps } = makeDeps(() => ok({ data: { viewer: { accounts: [] } } }));
    expect(await fetchUsage(env, deps, "2026-11-14")).toMatchObject({ ok: false, reason: "bad_response" });
  });
});

describe("fetchUsage empty data", () => {
  const withAccount = (patch: Record<string, unknown>) => {
    const copy = structuredClone(fixture) as any;
    Object.assign(copy.data.viewer.accounts[0], patch);
    return copy;
  };

  it("empty d1 storage rows → bad_response", async () => {
    const { deps } = makeDeps(() => ok(withAccount({ d1StorageAdaptiveGroups: [] })));
    expect(await fetchUsage(env, deps, "2026-11-14")).toMatchObject({ ok: false, reason: "bad_response" });
  });

  it("d1 storage row without databaseSizeBytes → bad_response", async () => {
    const { deps } = makeDeps(() => ok(withAccount({ d1StorageAdaptiveGroups: [{ max: {} }] })));
    expect(await fetchUsage(env, deps, "2026-11-14")).toMatchObject({ ok: false, reason: "bad_response" });
  });

  it("empty r2 storage rows → 0 bytes, no failure", async () => {
    const { deps } = makeDeps(() => ok(withAccount({ r2StorageAdaptiveGroups: [] })));
    expect(await fetchUsage(env, deps, "2026-11-14")).toMatchObject({ ok: true, value: { r2StorageBytes: 0 } });
  });

  it("r2 storage row missing a field → bad_response", async () => {
    const { deps } = makeDeps(() => ok(withAccount({ r2StorageAdaptiveGroups: [{ max: { payloadSize: 5 } }] })));
    expect(await fetchUsage(env, deps, "2026-11-14")).toMatchObject({ ok: false, reason: "bad_response" });
  });

  it("an unknown R2 actionType counts toward class A", async () => {
    const copy = withAccount({
      r2OperationsAdaptiveGroups: [{ sum: { requests: 7 }, dimensions: { actionType: "SomeNewAction" } }],
    });
    const { deps } = makeDeps(() => ok(copy));
    expect(await fetchUsage(env, deps, "2026-11-14")).toMatchObject({
      ok: true,
      value: { r2ClassAPerMonth: 7, r2ClassBPerMonth: 0 },
    });
  });
});

describe("runUsageWatch", () => {
  it("empty USAGE_ALERT_EMAIL → no fetch, no email, console.error naming it", async () => {
    const { env: e, sent, makeMessage } = makeEnv();
    const { deps, calls } = makeDeps(() => ok(fixture));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await runUsageWatch({ ...e, USAGE_ALERT_EMAIL: "" }, deps, makeMessage);
      expect(calls).toHaveLength(0);
      expect(sent).toEqual([]);
      expect(spy.mock.calls).toEqual([["usage watch misconfigured: USAGE_ALERT_EMAIL"]]);
    } finally {
      spy.mockRestore();
    }
  });

  it("empty CF_ACCOUNT_ID with an alert address → failure email, no fetch", async () => {
    const { env: e, sent, makeMessage } = makeEnv();
    const { deps, calls } = makeDeps(() => ok(fixture));
    await runUsageWatch({ ...e, CF_ACCOUNT_ID: "" }, deps, makeMessage);
    expect(calls).toHaveLength(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("alerts@example.test");
    expect(sent[0].raw).toContain("Subject: PakaPaka: Usage check failed (2026-11-14)");
    expect(sent[0].raw).toContain("misconfigured_CF_ACCOUNT_ID");
  });

  it("empty d1 storage rows → failure email with bad_response", async () => {
    const { env: e, sent, makeMessage } = makeEnv();
    const copy = structuredClone(fixture) as any;
    copy.data.viewer.accounts[0].d1StorageAdaptiveGroups = [];
    const { deps } = makeDeps(() => ok(copy));
    await runUsageWatch(e, deps, makeMessage);
    expect(sent).toHaveLength(1);
    expect(sent[0].raw).toContain("Usage check failed");
    expect(sent[0].raw).toContain("bad_response");
  });

  it("sends one email when a metric is high", async () => {
    const { env: e, sent, makeMessage } = makeEnv();
    const { deps } = makeDeps(() => ok(withWorkersRequests(80_000)));
    await runUsageWatch(e, deps, makeMessage);
    expect(sent).toHaveLength(1);
    expect(sent[0].from).toBe("alerts@paka-paka.app");
    expect(sent[0].to).toBe("alerts@example.test");
    expect(sent[0].raw).toContain("Subject: PakaPaka: free-plan usage above 70% (2026-11-14)");
    expect(sent[0].raw).toContain("workersRequestsPerDay");
    expect(sent[0].raw).toContain("80000 / 100000 (80%)");
    expect(sent[0].raw).not.toContain("d1WritesPerDay");
  });

  it("sends nothing when all are low", async () => {
    const { env: e, sent, makeMessage } = makeEnv();
    const { deps } = makeDeps(() => ok(fixture));
    await runUsageWatch(e, deps, makeMessage);
    expect(sent).toEqual([]);
  });

  it("sends a failure email when fetch fails", async () => {
    const { env: e, sent, makeMessage } = makeEnv();
    const { deps } = makeDeps(() => new Response("body with test-analytics-token", { status: 401 }));
    await runUsageWatch(e, deps, makeMessage);
    expect(sent).toHaveLength(1);
    expect(sent[0].raw).toContain("Subject: PakaPaka: Usage check failed (2026-11-14)");
    expect(sent[0].raw).toContain("http_401");
    expect(sent[0].raw).not.toContain("test-analytics-token");
    expect(sent[0].raw).not.toContain("body with");
  });
});
