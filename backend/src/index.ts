import { makeDeps } from "./deps";
import type { Env } from "./env";
import { errorResponse } from "./http";
import { rateLimit, toServerErrorResponse } from "./limits";
import { handleDeleteAccount, handleGetAccount, handleRemoveDevice, handleSignoutAll } from "./routes/account";
import { handleExchange, handleNonce } from "./routes/mobileAuth";
import { handleRefresh, handleSignout } from "./routes/session";
import { handleGetSync, handlePutSync } from "./routes/sync";
import { browserRateLimitResponse, handleGoogleCallback, handleSigninPage, handleSigninScript, handleWebStart } from "./routes/webAuth";
import { pruneRefreshTokens } from "./sessions";
import { runUsageWatch } from "./usage";

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (!pathname.startsWith("/api/") && !pathname.startsWith("/auth/")) {
      return env.ASSETS.fetch(req);
    }
    try {
      const route = `${req.method} ${pathname}`;
      // The script file is a static asset of the sign-in page: counting it would burn the budget on page loads.
      if (route !== "GET /auth/signin.js" && (pathname.startsWith("/api/auth/") || pathname.startsWith("/auth/"))) {
        const limited = await rateLimit(env.AUTH_LIMITER, req.headers.get("cf-connecting-ip") ?? "unknown");
        if (limited) return browserRateLimitResponse(route) ?? limited;
      }
      const deps = makeDeps(env);
      if (route === "POST /api/auth/nonce") return await handleNonce(req, env, deps);
      if (route === "POST /api/auth/exchange") return await handleExchange(req, env, deps);
      if (route === "GET /auth/signin") return handleSigninPage(req, env);
      if (route === "GET /auth/signin.js") return handleSigninScript();
      if (route === "POST /api/auth/web/start") return await handleWebStart(req, env, deps);
      if (route === "GET /api/auth/google/callback") return await handleGoogleCallback(req, env, deps);
      if (route === "POST /api/auth/refresh") return await handleRefresh(req, env, deps);
      if (route === "POST /api/auth/signout") return await handleSignout(req, env, deps);
      if (route === "GET /api/account") return await handleGetAccount(req, env, deps);
      if (route === "DELETE /api/account") return await handleDeleteAccount(req, env, deps);
      if (route === "POST /api/account/signout-all") return await handleSignoutAll(req, env, deps);
      if (route === "GET /api/sync") return await handleGetSync(req, env, deps);
      if (route === "PUT /api/sync") return await handlePutSync(req, env, deps);
      const device = req.method === "DELETE" ? /^\/api\/account\/devices\/([^/]+)$/.exec(pathname) : null;
      if (device) return await handleRemoveDevice(req, env, deps, device[1]);
      return errorResponse("not_found", 404);
    } catch (err) {
      return toServerErrorResponse(err);
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const deps = makeDeps(env);
    // Independent jobs: one failing must not skip the other. Log the error name only.
    const jobs = [
      ["usage watch", () => runUsageWatch(env, deps)],
      ["token prune", () => pruneRefreshTokens(env.DB, deps.now())],
    ] as const;
    ctx.waitUntil(
      Promise.all(
        jobs.map(async ([name, run]) => {
          try {
            await run();
          } catch (err) {
            console.error(`scheduled ${name} failed: ${(err as { name?: unknown } | null)?.name ?? "unknown"}`);
          }
        }),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
