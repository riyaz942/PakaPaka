import { makeDeps } from "./deps";
import type { Env } from "./env";
import { errorResponse } from "./http";
import { rateLimit } from "./limits";
import { handleExchange, handleNonce } from "./routes/mobileAuth";
import { handleRefresh, handleSignout } from "./routes/session";

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (!pathname.startsWith("/api/") && !pathname.startsWith("/auth/")) {
      return env.ASSETS.fetch(req);
    }
    try {
      if (pathname.startsWith("/api/auth/") || pathname.startsWith("/auth/")) {
        const limited = await rateLimit(env.AUTH_LIMITER, req.headers.get("cf-connecting-ip") ?? "unknown");
        if (limited) return limited;
      }
      const deps = makeDeps(env);
      const route = `${req.method} ${pathname}`;
      if (route === "POST /api/auth/nonce") return await handleNonce(req, env, deps);
      if (route === "POST /api/auth/exchange") return await handleExchange(req, env, deps);
      if (route === "POST /api/auth/refresh") return await handleRefresh(req, env, deps);
      if (route === "POST /api/auth/signout") return await handleSignout(req, env, deps);
      return errorResponse("not_found", 404);
    } catch {
      // Never include the error: it could carry request data.
      return errorResponse("server_error", 500);
    }
  },

  async scheduled(_event: ScheduledController, _env: Env, _ctx: ExecutionContext): Promise<void> {},
} satisfies ExportedHandler<Env>;
