import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/session", () => ({ requireSession: mockRequireSession }));

const mockCreateMicrosoftAuthUrl = vi.fn(
  (state: string) => `https://login.microsoftonline.com/authorize?state=${encodeURIComponent(state)}`
);
vi.mock("@/lib/microsoft-client", () => ({
  createMicrosoftAuthUrl: mockCreateMicrosoftAuthUrl,
}));

const { GET } = await import("@/app/api/auth/microsoft/route");
const { OAUTH_STATE_COOKIE, decodeOAuthState } = await import("@/lib/oauth-state");

function stateFrom(res: Response) {
  const location = res.headers.get("location") ?? "";
  return decodeOAuthState(new URL(location).searchParams.get("state"));
}

describe("GET /api/auth/microsoft — initiation OAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ userId: "owner" });
  });

  it("pose le cookie de nonce et l'inclut dans le state", async () => {
    const res = await GET();
    expect(res.status).toBe(307);
    const nonce = res.cookies.get(OAUTH_STATE_COOKIE)?.value;
    expect(nonce).toBeTruthy();
    expect(stateFrom(res)?.nonce).toBe(nonce);
    expect(stateFrom(res)?.redirect).toBe("/reminders");
  });

  it("génère un nonce différent à chaque appel", async () => {
    const first = await GET();
    const second = await GET();
    expect(first.cookies.get(OAUTH_STATE_COOKIE)?.value).not.toBe(
      second.cookies.get(OAUTH_STATE_COOKIE)?.value
    );
  });
});
