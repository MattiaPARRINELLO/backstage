import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireSession = vi.fn();
vi.mock("@/lib/session", () => ({ requireSession: mockRequireSession }));

const mockExchange = vi.fn();
const mockSaveTokens = vi.fn();
const mockClearGoogleBroken = vi.fn();
vi.mock("@/lib/google-client", () => ({
  exchangeAuthorizationCode: mockExchange,
  saveTokens: mockSaveTokens,
  clearGoogleBroken: mockClearGoogleBroken,
}));

vi.mock("@/lib/logger", () => ({ serverLog: vi.fn() }));

const { GET } = await import("@/app/api/auth/google/callback/route");
const { OAUTH_STATE_COOKIE, encodeOAuthState } = await import("@/lib/oauth-state");

function makeRequest(options: {
  state?: string;
  cookie?: string;
  code?: string;
  error?: string;
}): NextRequest {
  const url = new URL("http://localhost/api/auth/google/callback");
  if (options.state !== undefined) url.searchParams.set("state", options.state);
  if (options.code !== undefined) url.searchParams.set("code", options.code);
  if (options.error !== undefined) url.searchParams.set("error", options.error);
  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = `${OAUTH_STATE_COOKIE}=${options.cookie}`;
  return new NextRequest(url, { headers });
}

function makeState(payload: { nonce: string; redirect?: string; type?: string }): string {
  return encodeOAuthState({
    nonce: payload.nonce,
    redirect: payload.redirect ?? "/chat",
    ...(payload.type ? { type: payload.type } : {}),
  });
}

describe("GET /api/auth/google/callback — state lié au navigateur", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GOOGLE_REDIRECT_URI", "http://localhost/api/auth/google/callback");
    mockRequireSession.mockResolvedValue({ userId: "owner" });
    mockExchange.mockResolvedValue({ refresh_token: "refresh", access_token: "access" });
    mockSaveTokens.mockResolvedValue(undefined);
    mockClearGoogleBroken.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuse sans cookie de nonce (400) et n'échange pas le code", async () => {
    const res = await GET(
      makeRequest({ state: makeState({ nonce: "nonce-1234", type: "gmail" }), code: "code" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "state OAuth invalide" });
    expect(mockExchange).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie") ?? "").toContain(`${OAUTH_STATE_COOKIE}=;`);
  });

  it("refuse un state illisible", async () => {
    const res = await GET(makeRequest({ state: "n-importe-quoi", cookie: "nonce-1234", code: "code" }));
    expect(res.status).toBe(400);
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("accepte un nonce correct et redirige dans l'application", async () => {
    const res = await GET(
      makeRequest({
        state: makeState({ nonce: "nonce-1234", type: "gmail", redirect: "/chat" }),
        cookie: "nonce-1234",
        code: "code",
      })
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/chat?gmail=linked");
    expect(mockSaveTokens).toHaveBeenCalledWith(
      "gmail",
      { refresh_token: "refresh", access_token: "access" },
      { resetObtainedAt: true }
    );
    expect(res.headers.get("set-cookie") ?? "").toContain(`${OAUTH_STATE_COOKIE}=;`);
  });

  it("refuse un state de type calendar forgé avec un autre nonce", async () => {
    const res = await GET(
      makeRequest({
        state: makeState({ nonce: "nonce-attaquant", type: "calendar", redirect: "/chat" }),
        cookie: "nonce-1234",
        code: "code",
      })
    );
    expect(res.status).toBe(400);
    expect(mockSaveTokens).not.toHaveBeenCalled();
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("refuse un state sans type au lieu de retomber sur gmail", async () => {
    const res = await GET(
      makeRequest({
        state: makeState({ nonce: "nonce-1234", redirect: "/chat" }),
        cookie: "nonce-1234",
        code: "code",
      })
    );
    expect(res.status).toBe(400);
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("ne redirige jamais hors origine avec /\\evil.com", async () => {
    const res = await GET(
      makeRequest({
        state: makeState({ nonce: "nonce-1234", type: "gmail", redirect: "/\\evil.com" }),
        cookie: "nonce-1234",
        code: "code",
      })
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
  });

  it("efface le cookie de nonce sur une erreur OAuth", async () => {
    const res = await GET(
      makeRequest({
        state: makeState({ nonce: "nonce-1234", type: "gmail" }),
        cookie: "nonce-1234",
        error: "access_denied",
      })
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("set-cookie") ?? "").toContain(`${OAUTH_STATE_COOKIE}=;`);
  });
});
