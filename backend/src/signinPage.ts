import { TOKEN_CSS } from "./tokenCss.generated";

const COLOR = (name: string) => `rgb(var(--color-${name}))`;

const CSS =
  TOKEN_CSS +
  `*{box-sizing:border-box}` +
  `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
  `font-family:system-ui,sans-serif;color:${COLOR("primary")};` +
  `background:radial-gradient(60rem 30rem at 50% -10%,${COLOR("brand-soft")},transparent),${COLOR("background")}}` +
  `main{position:relative;width:100%;max-width:26rem;padding:2rem 1.25rem;margin:1rem}` +
  `.ghost{position:absolute;z-index:-1;top:-1.5rem;right:-1rem;font:700 12rem/1 serif;opacity:.06;pointer-events:none;user-select:none}` +
  `.brand{display:inline-block;margin:0 0 1.5rem;font-size:1.125rem;font-weight:700;letter-spacing:-.01em;color:${COLOR("brand-text")};text-decoration:none}` +
  `h1{margin:0 0 .5rem;font-size:1.875rem;line-height:1.15;letter-spacing:-.02em}` +
  `.lede{margin:0 0 1.5rem;color:${COLOR("muted")}}` +
  `.card{margin:0 0 1rem;padding:1.5rem;background:${COLOR("surface")};border:1px solid ${COLOR("border")};border-radius:1rem;` +
  `box-shadow:0 1px 2px rgb(0 0 0/.04);transition:border-color .15s,box-shadow .15s,transform .15s}` +
  `.card:hover,.card:focus-within{border-color:${COLOR("brand-400")};box-shadow:0 6px 18px rgb(0 0 0/.08);transform:translateY(-2px)}` +
  `h2{margin:0 0 .375rem;font-size:1.125rem}` +
  `.card p{margin:0 0 1rem;font-size:.9375rem;line-height:1.5;color:${COLOR("muted")}}` +
  `.card p.error{color:${COLOR("feedback-incorrect-deep")}}` +
  `.btn{display:block;width:100%;padding:.8rem 1rem;border:1.5px solid transparent;border-radius:.75rem;font:inherit;font-size:1rem;font-weight:600;` +
  `text-align:center;text-decoration:none;cursor:pointer;transition:background-color .15s,border-color .15s,box-shadow .15s,transform .1s}` +
  `.btn-primary{background:${COLOR("brand-600")};color:${COLOR("on-primary")}}` +
  `.btn-primary:hover:not(:disabled){background:${COLOR("brand-700")};box-shadow:0 4px 12px rgb(0 0 0/.18);transform:translateY(-1px)}` +
  `.btn-ghost{border-color:${COLOR("border")};background:${COLOR("surface-elevated")};color:${COLOR("primary")}}` +
  `.btn-ghost:hover:not(:disabled){border-color:${COLOR("brand-400")};background:${COLOR("surface-hover")};transform:translateY(-1px)}` +
  `.btn:active:not(:disabled){transform:translateY(1px);box-shadow:none}` +
  `.btn:focus-visible{outline:3px solid ${COLOR("ring")};outline-offset:2px}` +
  `.btn:disabled{opacity:.5;cursor:not-allowed}` +
  `.cf-turnstile{margin:0 0 .75rem;min-height:65px}` +
  `.back{display:block;margin-top:1.25rem;text-align:center;color:${COLOR("brand-text")}}` +
  `.back:hover{text-decoration:none}` +
  `@media (prefers-reduced-motion:reduce){*{transition:none!important}.card:hover,.card:focus-within,.btn:hover{transform:none!important}}`;

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
    `<title>Start learning</title><style>${CSS}</style></head><body><main>` +
    `<span class="ghost" aria-hidden="true">歩</span>` +
    `<a class="brand" href="/">PakaPaka</a>` +
    `<h1>Start learning</h1>` +
    `<p class="lede">Choose how you want to begin. You can change this later.</p>` +
    `<section class="card"><h2>Start without logging in</h2>` +
    `<p>Everything works with no account. Your progress stays on this device.</p>` +
    `<a class="btn btn-primary" href="/dashboard">Start now</a></section>` +
    `<section class="card"><h2>Log in with Google</h2>` +
    `<p>Optional. Keeps your progress the same on all your devices.</p>` +
    errorLine +
    `<form method="post" action="/api/auth/web/start">` +
    `<div class="cf-turnstile" data-sitekey="${escapeAttr(siteKey)}" data-callback="onTurnstileOk" ` +
    `data-expired-callback="onTurnstileExpired" data-error-callback="onTurnstileError"></div>` +
    `<button id="continue" class="btn btn-ghost" type="submit" disabled>Continue with Google</button>` +
    `</form></section>` +
    `<a class="back" href="/privacy-policy">Privacy policy</a>` +
    `<a class="back" href="/">Back to the home page</a>` +
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
    `<title>Start learning</title><style>${CSS}</style></head><body><main>` +
    `<a class="brand" href="/">PakaPaka</a>` +
    `<section class="card"><h2>Start learning</h2><p class="error" role="alert">${RATE_LIMITED_TEXT}</p>` +
    `<a class="btn btn-ghost" href="/dashboard">Start without logging in</a></section>` +
    `<a class="back" href="/">Back to the home page</a></main></body></html>`
  );
}
