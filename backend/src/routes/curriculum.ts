import type { Env } from "../env";
import { errorResponse } from "../http";

const MANIFEST_PATH = /^\/api\/curriculum\/s([1-9][0-9]{0,2})\/manifest\.json$/;
const FILE_PATH = /^\/api\/curriculum\/files\/([a-f0-9]{64})\.db$/;

function notFound(): Response {
  const res = errorResponse("not_found", 404);
  res.headers.set("cache-control", "no-store");
  return res;
}

/** Public, read-only. Reads no cookie and no header, logs nothing, never signs. */
export async function handleCurriculum(req: Request, env: Pick<Env, "CURRICULUM">): Promise<Response> {
  if (req.method !== "GET") return notFound();
  const { pathname } = new URL(req.url);
  const manifest = MANIFEST_PATH.exec(pathname);
  const file = manifest ? null : FILE_PATH.exec(pathname);
  if (!manifest && !file) return notFound();

  const key = manifest ? `s${manifest[1]}/manifest.json` : `files/${file![1]}.db`;
  const object = await env.CURRICULUM.get(key);
  if (!object) return notFound();

  return new Response(object.body, {
    status: 200,
    headers: {
      "content-type": manifest ? "application/json" : "application/vnd.sqlite3",
      "cache-control": manifest ? "public, max-age=300" : "public, max-age=31536000, immutable",
      "content-length": String(object.size),
      etag: object.httpEtag,
      "x-content-type-options": "nosniff",
    },
  });
}
