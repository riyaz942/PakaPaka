import { createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import type { Env } from "./env";

export type Deps = {
  now: () => number; // ms
  fetch: typeof fetch;
  googleJwks: JWTVerifyGetKey;
};

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function makeDeps(_env: Env): Deps {
  return {
    now: () => Date.now(),
    fetch: (input, init) => fetch(input, init),
    googleJwks,
  };
}
