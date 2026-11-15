import { authenticate, requireSameOrigin } from "../authenticate";
import type { Deps } from "../deps";
import type { Env } from "../env";
import { errorResponse, json } from "../http";
import { clearSessionCookies } from "../sessionCookies";
import { deleteUserRows, listDevices, revokeAllDevices, revokeDevice } from "../sessions";

function noContent(viaCookie: boolean): Response {
  const headers = new Headers();
  if (viaCookie) clearSessionCookies(headers);
  return new Response(null, { status: 204, headers });
}

export async function handleGetAccount(req: Request, env: Env, deps: Deps): Promise<Response> {
  const now = deps.now();
  const auth = await authenticate(req, env, now);
  if (!auth) return errorResponse("unauthorized", 401);
  const devices = await listDevices(env.DB, auth.userId, now);
  return json({
    provider: "google",
    devices: devices.map((d) => ({ ...d, current: d.deviceId === auth.deviceId })),
  });
}

export async function handleRemoveDevice(req: Request, env: Env, deps: Deps, deviceId: string): Promise<Response> {
  const now = deps.now();
  const auth = await authenticate(req, env, now);
  if (!auth) return errorResponse("unauthorized", 401);
  const badOrigin = requireSameOrigin(req, env, auth.viaCookie);
  if (badOrigin) return badOrigin;
  if (!(await revokeDevice(env.DB, auth.userId, deviceId, now))) return errorResponse("not_found", 404);
  return noContent(auth.viaCookie && deviceId === auth.deviceId);
}

export async function handleSignoutAll(req: Request, env: Env, deps: Deps): Promise<Response> {
  const now = deps.now();
  const auth = await authenticate(req, env, now);
  if (!auth) return errorResponse("unauthorized", 401);
  const badOrigin = requireSameOrigin(req, env, auth.viaCookie);
  if (badOrigin) return badOrigin;
  await revokeAllDevices(env.DB, auth.userId, now);
  return noContent(auth.viaCookie);
}

export async function handleDeleteAccount(req: Request, env: Env, deps: Deps): Promise<Response> {
  const auth = await authenticate(req, env, deps.now());
  if (!auth) return errorResponse("unauthorized", 401);
  const badOrigin = requireSameOrigin(req, env, auth.viaCookie);
  if (badOrigin) return badOrigin;

  // R2 first: if D1 then fails, the user row survives and a retry finishes the job.
  const prefix = `progress/${auth.userId}/`;
  let cursor: string | undefined;
  do {
    const page = await env.PROGRESS.list({ prefix, cursor });
    if (page.objects.length > 0) await env.PROGRESS.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor !== undefined);

  await deleteUserRows(env.DB, auth.userId);
  return noContent(auth.viaCookie);
}
