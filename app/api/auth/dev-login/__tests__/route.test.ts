import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetConfig = vi.fn();
vi.mock("@/lib/config", () => ({ getConfig: mockGetConfig }));

const mockCreateSession = vi.fn();
vi.mock("@/lib/session", () => ({ createSession: mockCreateSession }));

const { GET } = await import("../route");

describe("GET /api/auth/dev-login", () => {
  beforeEach(() => {
    mockGetConfig.mockReset();
    mockCreateSession.mockReset();
  });

  it("repond 404 en production meme avec DEV_AUTH_BYPASS", async () => {
    mockGetConfig.mockReturnValue({ DEV_AUTH_BYPASS: true, NODE_ENV: "production" });

    const res = await GET(new NextRequest("https://backstage.localhost/api/auth/dev-login"));

    expect(res.status).toBe(404);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("repond 404 sans DEV_AUTH_BYPASS", async () => {
    mockGetConfig.mockReturnValue({ DEV_AUTH_BYPASS: false, NODE_ENV: "development" });

    const res = await GET(new NextRequest("https://backstage.localhost/api/auth/dev-login"));

    expect(res.status).toBe(404);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("ouvre une session hors production quand le bypass est actif", async () => {
    mockGetConfig.mockReturnValue({ DEV_AUTH_BYPASS: true, NODE_ENV: "development" });

    const res = await GET(new NextRequest("https://backstage.localhost/api/auth/dev-login"));

    expect(res.status).toBe(307);
    expect(mockCreateSession).toHaveBeenCalledWith("owner");
  });
});
