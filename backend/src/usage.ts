import { EmailMessage } from "cloudflare:email";
import type { Deps } from "./deps";
import type { Env } from "./env";
import type { Result } from "./result";

// Cloudflare free-plan limits, from the parent spec (checked 2026-11-03).
export const FREE_LIMITS = {
  workersRequestsPerDay: 100_000,
  d1ReadsPerDay: 5_000_000,
  d1WritesPerDay: 100_000,
  // Per-database limit on the free plan (the account total is 5 GB). developers.cloudflare.com/d1/platform/limits/, checked 2026-11-15.
  d1StorageBytes: 500_000_000,
  r2ClassAPerMonth: 1_000_000,
  r2ClassBPerMonth: 10_000_000,
  r2StorageBytes: 10e9,
};

// Day metrics = yesterday (UTC); R2 operations = month to date; storage = latest value.
export type UsageSnapshot = Record<keyof typeof FREE_LIMITS, number>;

export type UsageFetchFailure = { ok: false; error: "usage_fetch_failed"; reason: string };

const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

// Field names checked against developers.cloudflare.com (2026-11-15):
//   workersInvocationsAdaptive  sum { requests }, filter datetime_geq/datetime_leq  (Workers GraphQL tutorial)
//   d1AnalyticsAdaptiveGroups   filter date_geq/date_leq; sum { readQueries writeQueries }; rowsRead and
//                               rowsWritten are listed as D1 metrics but the docs show no `sum` example
//   r2OperationsAdaptiveGroups  sum { requests }, dimensions { actionType }, filter datetime_geq/datetime_leq
//   r2StorageAdaptiveGroups     max { payloadSize metadataSize }, dimensions { datetime }, orderBy datetime_DESC
// NOT verified (no docs page shows it): d1StorageAdaptiveGroups `max { databaseSizeBytes }` with
// date_geq/date_leq and orderBy date_DESC. The docs name the metric `databaseSizeBytes` only.
// Day metrics use datetime filters for Workers and R2 because those docs show no `date` filter.
const QUERY = `query Usage($accountTag: string!, $day: Date!, $dayStart: Time!, $dayEnd: Time!, $monthStart: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: $dayStart, datetime_leq: $dayEnd }) {
        sum { requests }
      }
      d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date_geq: $day, date_leq: $day }) {
        sum { rowsRead rowsWritten }
      }
      d1StorageAdaptiveGroups(limit: 1, filter: { date_geq: $day, date_leq: $day }, orderBy: [date_DESC]) {
        max { databaseSizeBytes }
      }
      r2OperationsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $monthStart, datetime_leq: $dayEnd }) {
        sum { requests }
        dimensions { actionType }
      }
      r2StorageAdaptiveGroups(limit: 1, filter: { datetime_geq: $dayStart, datetime_leq: $dayEnd }, orderBy: [datetime_DESC]) {
        max { payloadSize metadataSize }
      }
    }
  }
}`;

// Class B actions per https://developers.cloudflare.com/r2/platform/pricing/ (checked 2026-11-15).
// Every other action counts as Class A. That list is long and may grow (e.g. "ListObjectsV2" is not on the
// page), so an unknown action fails closed toward alerting. Free actions such as DeleteObject are
// therefore over-counted; the watch is only a warning, so that is the safe side.
const R2_CLASS_B = new Set([
  "HeadBucket",
  "HeadObject",
  "GetObject",
  "UsageSummary",
  "GetBucketEncryption",
  "GetBucketLocation",
  "GetBucketCors",
  "GetBucketLifecycleConfiguration",
]);

type Row = Record<string, any>;

const sumOf = (rows: Row[], key: string) => rows.reduce((n, r) => n + Number(r.sum[key]), 0);

function strictNumber(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("non-numeric");
  return v;
}

function parseAccount(a: Row): UsageSnapshot {
  const r2Ops: Row[] = a.r2OperationsAdaptiveGroups;
  const r2Requests = (classB: boolean) =>
    sumOf(
      r2Ops.filter((r) => R2_CLASS_B.has(r.dimensions.actionType) === classB),
      "requests",
    );
  // No D1 storage row means the filter matched nothing (the database always has a size): treat as a bad response.
  const d1Storage: Row | undefined = a.d1StorageAdaptiveGroups[0];
  if (!d1Storage) throw new Error("no d1 storage row");
  // No R2 storage row is legitimate (empty bucket): 0 bytes. A present row must have both fields.
  const r2Storage: Row | undefined = a.r2StorageAdaptiveGroups[0];
  const snapshot: UsageSnapshot = {
    workersRequestsPerDay: sumOf(a.workersInvocationsAdaptive, "requests"),
    d1ReadsPerDay: sumOf(a.d1AnalyticsAdaptiveGroups, "rowsRead"),
    d1WritesPerDay: sumOf(a.d1AnalyticsAdaptiveGroups, "rowsWritten"),
    d1StorageBytes: strictNumber(d1Storage.max.databaseSizeBytes),
    r2ClassAPerMonth: r2Requests(false),
    r2ClassBPerMonth: r2Requests(true),
    r2StorageBytes: r2Storage ? strictNumber(r2Storage.max.payloadSize) + strictNumber(r2Storage.max.metadataSize) : 0,
  };
  if (Object.values(snapshot).some((v) => !Number.isFinite(v))) throw new Error("non-numeric");
  return snapshot;
}

export async function fetchUsage(
  env: Env,
  deps: Deps,
  day: string, // YYYY-MM-DD
): Promise<Result<UsageSnapshot, "usage_fetch_failed"> | UsageFetchFailure> {
  const fail = (reason: string): UsageFetchFailure => ({ ok: false, error: "usage_fetch_failed", reason });
  let res: Response;
  try {
    res = await deps.fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          accountTag: env.CF_ACCOUNT_ID,
          day,
          dayStart: `${day}T00:00:00Z`,
          dayEnd: `${day}T23:59:59Z`,
          monthStart: `${day.slice(0, 7)}-01T00:00:00Z`,
        },
      }),
    });
  } catch {
    return fail("network");
  }
  if (!res.ok) return fail(`http_${res.status}`);
  let body: Row;
  try {
    body = await res.json();
  } catch {
    return fail("bad_response");
  }
  if (Array.isArray(body.errors) && body.errors.length > 0) return fail("graphql_errors");
  try {
    return { ok: true, value: parseAccount(body.data.viewer.accounts[0]) };
  } catch {
    return fail("bad_response");
  }
}

export function evaluateUsage(
  s: UsageSnapshot,
  threshold = 0.7,
): Array<{ metric: keyof UsageSnapshot; used: number; limit: number }> {
  return (Object.keys(FREE_LIMITS) as Array<keyof UsageSnapshot>)
    .map((metric) => ({ metric, used: s[metric], limit: FREE_LIMITS[metric] }))
    .filter((m) => m.used / m.limit >= threshold);
}

function rawEmail(from: string, to: string, subject: string, lines: string[]): string {
  const host = from.split("@")[1];
  return [
    `From: PakaPaka <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: <${crypto.randomUUID()}@${host}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    ...lines,
  ].join("\r\n");
}

export function buildAlertEmail(
  from: string,
  to: string,
  alerts: ReturnType<typeof evaluateUsage>,
  day: string,
): string {
  return rawEmail(
    from,
    to,
    `PakaPaka: free-plan usage above 70% (${day})`,
    [
      `Cloudflare free-plan usage for ${day} (UTC):`,
      "",
      ...alerts.map((a) => `${a.metric}: ${a.used} / ${a.limit} (${Math.round((a.used / a.limit) * 100)}%)`),
    ],
  );
}

// Only the day and a short reason code: never the token, response body or error text.
function buildFailureEmail(from: string, to: string, day: string, reason: string): string {
  return rawEmail(from, to, `PakaPaka: Usage check failed (${day})`, [
    `The usage check for ${day} (UTC) failed.`,
    `Reason: ${reason}`,
  ]);
}

// `makeMessage` is injectable because a workerd EmailMessage does not expose its raw text to tests.
export async function runUsageWatch(
  env: Env,
  deps: Deps,
  makeMessage: (from: string, to: string, raw: string) => EmailMessage = (from, to, raw) =>
    new EmailMessage(from, to, raw),
): Promise<void> {
  if (!env.USAGE_ALERT_EMAIL) {
    console.error("usage watch misconfigured: USAGE_ALERT_EMAIL");
    return;
  }
  const day = new Date(deps.now() - 86_400_000).toISOString().slice(0, 10);
  const from = `alerts@${new URL(env.APP_ORIGIN).hostname}`;
  const to = env.USAGE_ALERT_EMAIL;
  const send = (raw: string) => env.ALERT_EMAIL.send(makeMessage(from, to, raw));

  // A missing account id would make every query fail: say so by email instead of staying quiet.
  if (!env.CF_ACCOUNT_ID) {
    await send(buildFailureEmail(from, to, day, "misconfigured_CF_ACCOUNT_ID"));
    return;
  }
  const result = await fetchUsage(env, deps, day);
  if (!result.ok) {
    // The watch must not go quiet: a failed check is itself reported.
    await send(buildFailureEmail(from, to, day, "reason" in result ? result.reason : "unknown"));
    return;
  }
  const alerts = evaluateUsage(result.value);
  if (alerts.length > 0) await send(buildAlertEmail(from, to, alerts, day));
}
