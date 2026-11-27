import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockHasGoogleTokens = vi.fn();
vi.mock("@/lib/google-client", () => ({ hasGoogleTokens: mockHasGoogleTokens }));

const mockFetchGmailMessages = vi.fn();
vi.mock("@/lib/google-actions", () => ({
  fetchGmailMessages: mockFetchGmailMessages,
  sendGmailReply: vi.fn(),
}));

vi.mock("@/lib/server-cache", () => ({
  getServerCached: () => null,
  setServerCached: vi.fn(),
  invalidateServerCachePattern: vi.fn(),
}));

const { GET } = await import("../route");

describe("GET /api/gmail", () => {
  beforeEach(() => {
    mockHasGoogleTokens.mockReset();
    mockFetchGmailMessages.mockReset();
  });

  it("repond 200 avec une liste vide quand le compte n'est pas lie", async () => {
    mockHasGoogleTokens.mockResolvedValue(false);

    const res = await GET(new NextRequest("https://backstage.localhost/api/gmail"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ linked: false, messages: [] });
    expect(mockFetchGmailMessages).not.toHaveBeenCalled();
  });

  it("lit la boite et marque la reponse comme liee quand un jeton existe", async () => {
    mockHasGoogleTokens.mockResolvedValue(true);
    mockFetchGmailMessages.mockResolvedValue([]);

    const res = await GET(new NextRequest("https://backstage.localhost/api/gmail"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ linked: true, messages: [] });
  });
});
