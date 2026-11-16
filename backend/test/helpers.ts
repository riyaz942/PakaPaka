import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload, type JWTVerifyGetKey } from "jose";

export async function makeTestGoogle(): Promise<{
  jwks: JWTVerifyGetKey;
  sign(claims?: Partial<JWTPayload> & { nonce?: string }): Promise<string>;
}> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256", use: "sig" };
  const jwks = createLocalJWKSet({ keys: [jwk] });
  return {
    jwks,
    async sign(claims = {}) {
      const now = Math.floor(Date.now() / 1000);
      const payload: JWTPayload = {
        iss: "https://accounts.google.com",
        aud: "web-client",
        sub: "g-123",
        iat: now,
        exp: now + 3600,
        ...claims,
      };
      return new SignJWT(payload).setProtectedHeader({ alg: "RS256", kid: "test-key" }).sign(privateKey);
    },
  };
}
