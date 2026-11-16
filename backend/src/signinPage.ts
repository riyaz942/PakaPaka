import { TOKEN_CSS } from "./tokenCss.generated";

const COLOR = (name: string) => `rgb(var(--color-${name}))`;

const CSS =
  TOKEN_CSS +
  `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
  `font-family:system-ui,sans-serif;background:${COLOR("background")};color:${COLOR("primary")}}` +
  `main{box-sizing:border-box;width:100%;max-width:24rem;padding:2rem 1.5rem;margin:1rem;` +
  `background:${COLOR("surface")};border:1px solid ${COLOR("border")};border-radius:1rem}` +
  `h1{margin:0 0 .5rem;font-size:1.5rem}` +
  `p{margin:0 0 1.5rem;color:${COLOR("muted")}}` +
  `p.error{color:${COLOR("feedback-incorrect-deep")}}` +
  `button{display:block;width:100%;margin-top:1rem;padding:.75rem 1rem;border:0;border-radius:.75rem;` +
  `font-size:1rem;font-weight:600;background:${COLOR("brand-600")};color:${COLOR("on-primary")}}` +
  `button:disabled{opacity:.5}` +
  `a{display:block;margin-top:1.5rem;text-align:center;color:${COLOR("brand-text")}}`;

export const SIGNIN_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "content-security-policy":
    "default-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; " +
    "style-src 'unsafe-inline'; connect-src 'self'; form-action 'self' https://accounts.google.com; " +
    "frame-ancestors 'none'; base-uri 'none'",
  "x-content-type-options": "nosniff",
  // Not no-referrer: that makes browsers send `Origin: null` on the form POST, which the start route rejects.
  "referrer-policy": "strict-origin-when-cross-origin",
  "cache-control": "no-store",
};

const ERROR_TEXT = "Check failed. Try again.";
const RATE_LIMITED_TEXT = "Too many attempts. Try again in a minute.";

export const SIGNIN_SCRIPT =
  "const button = () => document.getElementById('continue');\n" +
  "const errorLine = () => document.getElementById('error');\n" +
  "window.onTurnstileOk = () => { button().disabled = false; errorLine().hidden = true; };\n" +
  "window.onTurnstileExpired = () => { button().disabled = true; };\n" +
  `window.onTurnstileError = () => { button().disabled = true; errorLine().textContent = '${ERROR_TEXT}'; errorLine().hidden = false; };\n`;

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function signinPage(siteKey: string, error: string | null): string {
  const text = error === "turnstile" || error === "origin" ? ERROR_TEXT : error === "rate_limited" ? RATE_LIMITED_TEXT : null;
  const errorLine = `<p class="error" id="error" role="alert"${text ? "" : " hidden"}>${text ?? ""}</p>`;
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Sign in to sync</title><style>${CSS}</style></head><body><main>` +
    `<h1>Sign in to sync</h1>` +
    `<p>Optional. Keeps your progress the same on all your devices.</p>` +
    errorLine +
    `<form method="post" action="/api/auth/web/start">` +
    `<div class="cf-turnstile" data-sitekey="${escapeAttr(siteKey)}" data-callback="onTurnstileOk" ` +
    `data-expired-callback="onTurnstileExpired" data-error-callback="onTurnstileError"></div>` +
    `<button id="continue" type="submit" disabled>Continue with Google</button>` +
    `</form><a href="/settings">Back to the app</a>` +
    `<script src="/auth/signin.js"></script>` +
    `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` +
    `</main></body></html>`
  );
}

// Shown instead of the sign-in page when the auth rate limit is hit: no form, no scripts.
export function rateLimitedPage(): string {
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Sign in to sync</title><style>${CSS}</style></head><body><main>` +
    `<h1>Sign in to sync</h1><p class="error" role="alert">${RATE_LIMITED_TEXT}</p>` +
    `<a href="/settings">Back to the app</a></main></body></html>`
  );
}
