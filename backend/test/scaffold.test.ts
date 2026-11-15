import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { parseCookies, serializeCookie } from "../src/http";

describe("worker scaffold", () => {
  it("unknown api route returns 404 json", async () => {
    const res = await SELF.fetch("https://paka-paka.app/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("migrations create the four tables", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'",
    ).all<{ name: string }>();
    const names = results.map((r) => r.name);
    for (const t of ["users", "identities", "sync_state", "refresh_tokens"]) {
      expect(names).toContain(t);
    }
  });
});

describe("cookies", () => {
  it("serializeCookie always adds Secure and SameSite=Lax", () => {
    expect(serializeCookie("a", "b", { maxAge: 5, path: "/", httpOnly: true })).toBe(
      "a=b; Max-Age=5; Path=/; HttpOnly; Secure; SameSite=Lax",
    );
  });

  it("serializeCookie omits HttpOnly when false", () => {
    expect(serializeCookie("a", "b", { maxAge: 5, path: "/", httpOnly: false })).toBe(
      "a=b; Max-Age=5; Path=/; Secure; SameSite=Lax",
    );
  });

  it("parseCookies reads pairs", () => {
    expect(parseCookies("x=1; y=2")).toEqual({ x: "1", y: "2" });
  });

  it("parseCookies handles null", () => {
    expect(parseCookies(null)).toEqual({});
  });
});
