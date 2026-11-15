import path from "node:path";
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
  return {
    plugins: [
      cloudflareTest({
        main: "./src/index.ts",
        miniflare: {
          compatibilityDate: "2026-11-01",
          d1Databases: ["DB"],
          r2Buckets: ["PROGRESS"],
          ratelimits: {
            AUTH_LIMITER: { namespace_id: "1001", simple: { limit: 10, period: 60 } },
            UPLOAD_LIMITER: { namespace_id: "1002", simple: { limit: 6, period: 60 } },
          },
          email: { send_email: [{ name: "ALERT_EMAIL" }] },
          // Stub for the static-asset binding: tests never read mobile/dist.
          serviceBindings: { ASSETS: () => new Response("asset", { status: 200 }) },
          bindings: {
            TEST_MIGRATIONS: migrations,
            APP_ORIGIN: "https://paka-paka.app",
            GOOGLE_WEB_CLIENT_ID: "web-client",
            GOOGLE_IOS_CLIENT_IDS: "ios-a,ios-b",
            TURNSTILE_SITE_KEY: "turnstile-site-key",
            USAGE_ALERT_EMAIL: "alerts@example.test",
            CF_ACCOUNT_ID: "test-account",
            SESSION_SIGNING_KEY: "test-session-signing-key-0123456789abcdef",
            HMAC_KEY: "test-hmac-key-0123456789abcdef",
            GOOGLE_WEB_CLIENT_SECRET: "test-google-secret",
            TURNSTILE_SECRET: "test-turnstile-secret",
            CF_ANALYTICS_TOKEN: "test-analytics-token",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
