import { describe, it, expect } from "vitest";

// La signature edge utilise AUTH_SECRET (pas data/.auth-secret)
const TEST_SECRET = "test-secret-thirtytwo-chars-long-for-hmac!!";
process.env.AUTH_SECRET = TEST_SECRET;

const { verifyJwt, SESSION_COOKIE } = await import("@/lib/session-edge");
const { signJwt, TOKEN_PURPOSE } = await import("@/lib/session-core");

describe("session-edge", () => {
  it("exporte SESSION_COOKIE", () => {
    expect(SESSION_COOKIE).toBe("pb_session");
  });

  it("verifyJwt rejette un token mal formé", async () => {
    expect(await verifyJwt("not.a.token", "session")).toBeNull();
  });

  it("verifyJwt rejette un token avec 2 parties", async () => {
    expect(await verifyJwt("abc.def", "session")).toBeNull();
  });

  it("verifyJwt valide un token signé par session-core", async () => {
    const payload = {
      sub: "user123",
      role: "admin",
      purpose: TOKEN_PURPOSE.session,
    };
    const token = await signJwt(payload);
    const decoded = await verifyJwt<{ sub: string }>(token, "session");
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe("user123");
  });

  it("verifyJwt rejette un token expiré", async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const payload = { sub: "user123", purpose: TOKEN_PURPOSE.session, exp: past };
    const token = await signJwt(payload);
    expect(await verifyJwt(token, "session")).toBeNull();
  });

  it("verifyJwt rejette un token avec signature modifiée", async () => {
    const payload = { sub: "user123", purpose: TOKEN_PURPOSE.session };
    const token = await signJwt(payload);
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;
    expect(await verifyJwt(tampered, "session")).toBeNull();
  });

  it("verifyJwt rejette un token de challenge présenté comme session", async () => {
    const token = await signJwt({
      challenge: "abc",
      purpose: TOKEN_PURPOSE.challenge,
    });
    expect(await verifyJwt(token, "session")).toBeNull();
    expect(await verifyJwt(token, "challenge")).not.toBeNull();
  });

  it("verifyJwt rejette un token sans claim purpose", async () => {
    const token = await signJwt({ sub: "user123" });
    expect(await verifyJwt(token, "session")).toBeNull();
  });

  // Note: impossible de tester "clé différente" car ESM module cache
  // réutilise l'instance. Le test de signature modifiée valide déjà le rejet.
});
