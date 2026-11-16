import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireSession = vi.fn();
vi.mock("@/lib/session", () => ({ requireSession: mockRequireSession }));

const mockGenerateAuthUrl = vi.fn(
  (options: { state?: string }) =>
    `https://accounts.google.com/o/oauth2/auth?state=${encodeURIComponent(options.state ?? "")}`
);
vi.mock("@/lib/google-client", () => ({
  createOAuth2Client: () => ({ generateAuthUrl: mockGenerateAuthUrl }),
}));

const { GET } = await import("@/app/api/auth/google/route");
const { OAUTH_STATE_COOKIE, decodeOAuthState } = await import("@/lib/oauth-state");

function makeRequest(url: string): NextRequest {
  return new NextRequest(url);
}

function stateFrom(res: Response) {
  const location = res.headers.get("location") ?? "";
  const raw = new URL(location).searchParams.get("state");
  return decodeOAuthState(raw);
}

describe("GET /api/auth/google — initiation OAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ userId: "owner" });
  });

  it("pose le cookie de nonce httpOnly, sameSite lax, 10 minutes", async () => {
    const res = await GET(makeRequest("http://localhost/api/auth/google?type=gmail"));

    expect(res.status).toBe(307);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${OAUTH_STATE_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie.toLowerCase()).toContain("path=/");
    expect(cookie.toLowerCase()).toContain("max-age=600");
    expect(res.cookies.get(OAUTH_STATE_COOKIE)?.value).toBeTruthy();
  });

  it("génère un nonce différent à chaque appel", async () => {
    const first = await GET(makeRequest("http://localhost/api/auth/google?type=gmail"));
    const second = await GET(makeRequest("http://localhost/api/auth/google?type=gmail"));
    expect(first.cookies.get(OAUTH_STATE_COOKIE)?.value).not.toBe(
      second.cookies.get(OAUTH_STATE_COOKIE)?.value
    );
  });

  it("le nonce du state est celui du cookie", async () => {
    const res = await GET(makeRequest("http://localhost/api/auth/google?type=calendar"));
    const state = stateFrom(res);
    expect(state?.nonce).toBe(res.cookies.get(OAUTH_STATE_COOKIE)?.value);
    expect(state?.type).toBe("calendar");
  });

  it("ramène //evil.com et /\\evil.com sur une destination de l'origine", async () => {
    const protocolRelative = await GET(
      makeRequest("http://localhost/api/auth/google?type=gmail&redirect=%2F%2Fevil.com")
    );
    expect(stateFrom(protocolRelative)?.redirect).toBe("/chat");

    const backslash = await GET(
      makeRequest("http://localhost/api/auth/google?type=gmail&redirect=%2F%5Cevil.com")
    );
    expect(stateFrom(backslash)?.redirect).toBe("/chat");

    const absolute = await GET(
      makeRequest("http://localhost/api/auth/google?type=gmail&redirect=https%3A%2F%2Fevil.com")
    );
    expect(stateFrom(absolute)?.redirect).toBe("/chat");
  });

  it("conserve une destination interne", async () => {
    const res = await GET(
      makeRequest("http://localhost/api/auth/google?type=gmail&redirect=%2Freminders")
    );
    expect(stateFrom(res)?.redirect).toBe("/reminders");
  });
});
