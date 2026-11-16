import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireSession = vi.fn();
vi.mock("@/lib/session", () => ({ requireSession: mockRequireSession }));

const mockGetTokens = vi.fn();
const mockSaveTokens = vi.fn();
vi.mock("@/lib/microsoft-client", () => ({
  getMicrosoftTokensFromCode: mockGetTokens,
  saveMicrosoftTokens: mockSaveTokens,
}));

vi.mock("@/lib/logger", () => ({ serverLog: vi.fn() }));

const { GET } = await import("@/app/api/auth/microsoft/callback/route");
const { OAUTH_STATE_COOKIE, encodeOAuthState } = await import("@/lib/oauth-state");

function makeRequest(options: { state?: string; cookie?: string; code?: string }): NextRequest {
  const url = new URL("http://localhost/api/auth/microsoft/callback");
  if (options.state !== undefined) url.searchParams.set("state", options.state);
  if (options.code !== undefined) url.searchParams.set("code", options.code);
  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = `${OAUTH_STATE_COOKIE}=${options.cookie}`;
  return new NextRequest(url, { headers });
}

describe("GET /api/auth/microsoft/callback — state lié au navigateur", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ userId: "owner" });
    mockGetTokens.mockResolvedValue({ refresh_token: "refresh" });
    mockSaveTokens.mockResolvedValue(undefined);
  });

  it("refuse sans state (400) et n'échange pas le code", async () => {
    const res = await GET(makeRequest({ cookie: "nonce-1234", code: "code" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "state OAuth invalide" });
    expect(mockGetTokens).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie") ?? "").toContain(`${OAUTH_STATE_COOKIE}=;`);
  });

  it("refuse un nonce différent du cookie", async () => {
    const state = encodeOAuthState({ nonce: "nonce-attaquant", redirect: "/reminders" });
    const res = await GET(makeRequest({ state, cookie: "nonce-1234", code: "code" }));
    expect(res.status).toBe(400);
    expect(mockGetTokens).not.toHaveBeenCalled();
  });

  it("accepte un nonce correct et redirige vers /reminders?todo=linked", async () => {
    const state = encodeOAuthState({ nonce: "nonce-1234", redirect: "/reminders" });
    const res = await GET(makeRequest({ state, cookie: "nonce-1234", code: "code" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/reminders?todo=linked");
    expect(mockGetTokens).toHaveBeenCalledWith("code");
    expect(mockSaveTokens).toHaveBeenCalledWith({ refresh_token: "refresh" });
    expect(res.headers.get("set-cookie") ?? "").toContain(`${OAUTH_STATE_COOKIE}=;`);
  });

  it("ne redirige jamais hors origine", async () => {
    const state = encodeOAuthState({ nonce: "nonce-1234", redirect: "//evil.com" });
    const res = await GET(makeRequest({ state, cookie: "nonce-1234", code: "code" }));
    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
    expect(mockGetTokens).not.toHaveBeenCalled();
  });
});
