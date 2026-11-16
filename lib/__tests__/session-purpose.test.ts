import { describe, it, expect, beforeEach, vi } from "vitest";

process.env.AUTH_SECRET = "test-secret-thirtytwo-chars-long-for-hmac!!";

// Faux cookie store en mémoire : lib/session.ts utilise cookies() de
// next/headers, indisponible hors requête Next.
const { store, cookieStore } = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    cookieStore: {
      get: (name: string) =>
        store.has(name) ? { name, value: store.get(name) as string } : undefined,
      set: (name: string, value: string) => {
        store.set(name, value);
      },
    },
  };
});

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

const {
  createSession,
  createChallenge,
  getSession,
  consumeChallenge,
  signJwt,
  TOKEN_PURPOSE,
  SESSION_COOKIE,
  CHALLENGE_COOKIE,
} = await import("@/lib/session");

describe("lib/session — séparation session / challenge", () => {
  beforeEach(() => {
    store.clear();
    process.env.AUTH_SECRET = "test-secret-thirtytwo-chars-long-for-hmac!!";
  });

  it("createSession émet une session lisible par getSession", async () => {
    await createSession("owner");
    expect(await getSession()).toEqual({ userId: "owner" });
  });

  it("createChallenge émet un challenge lisible par consumeChallenge", async () => {
    await createChallenge("defi-123");
    expect(await consumeChallenge()).toBe("defi-123");
  });

  it("rejette un token de challenge rejoué comme cookie de session", async () => {
    await createChallenge("defi-123");
    const challengeToken = store.get(CHALLENGE_COOKIE) as string;
    store.set(SESSION_COOKIE, challengeToken);
    expect(await getSession()).toBeNull();
  });

  it("rejette un token de session rejoué comme cookie de challenge", async () => {
    await createSession("owner");
    const sessionToken = store.get(SESSION_COOKIE) as string;
    store.set(CHALLENGE_COOKIE, sessionToken);
    expect(await consumeChallenge()).toBeNull();
  });

  it("rejette un token signé sans claim purpose", async () => {
    const token = await signJwt({
      sub: "owner",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    store.set(SESSION_COOKIE, token);
    expect(await getSession()).toBeNull();
  });

  it("accepte un token signé avec le bon usage", async () => {
    const token = await signJwt({
      sub: "owner",
      purpose: TOKEN_PURPOSE.session,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    store.set(SESSION_COOKIE, token);
    expect(await getSession()).toEqual({ userId: "owner" });
  });
});
