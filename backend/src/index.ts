import type { Env } from "./env";
import { errorResponse } from "./http";

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname.startsWith("/api/")) {
      return errorResponse("not_found", 404);
    }
    return env.ASSETS.fetch(req);
  },

  async scheduled(_event: ScheduledController, _env: Env, _ctx: ExecutionContext): Promise<void> {},
} satisfies ExportedHandler<Env>;
