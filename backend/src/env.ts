export interface Env {
  DB: D1Database;
  PROGRESS: R2Bucket;
  AUTH_LIMITER: RateLimit;
  UPLOAD_LIMITER: RateLimit;
  ALERT_EMAIL: SendEmail;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  GOOGLE_WEB_CLIENT_ID: string;
  GOOGLE_IOS_CLIENT_IDS: string;
  TURNSTILE_SITE_KEY: string;
  USAGE_ALERT_EMAIL: string;
  CF_ACCOUNT_ID: string;
  // Secrets (set with `wrangler secret put`)
  SESSION_SIGNING_KEY: string;
  HMAC_KEY: string;
  GOOGLE_WEB_CLIENT_SECRET: string;
  TURNSTILE_SECRET: string;
  CF_ANALYTICS_TOKEN: string;
}
