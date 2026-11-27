import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockHasGoogleTokens = vi.fn();
vi.mock("@/lib/google-client", () => ({ hasGoogleTokens: mockHasGoogleTokens }));

const mockFetchEvents = vi.fn();
vi.mock("@/lib/google-actions", () => ({
  fetchGoogleCalendarEvents: mockFetchEvents,
  createGoogleCalendarEvent: vi.fn(),
  updateGoogleCalendarEvent: vi.fn(),
  deleteGoogleCalendarEvent: vi.fn(),
}));

vi.mock("@/lib/server-cache", () => ({
  getServerCached: () => null,
  setServerCached: vi.fn(),
  invalidateServerCache: vi.fn(),
}));

const { GET } = await import("../route");

const RANGE =
  "/api/calendar?timeMin=2026-11-01T00:00:00.000Z&timeMax=2026-11-30T23:59:59.999Z";

describe("GET /api/calendar", () => {
  beforeEach(() => {
    mockHasGoogleTokens.mockReset();
    mockFetchEvents.mockReset();
  });

  it("repond 200 avec une liste vide quand le compte n'est pas lie", async () => {
    mockHasGoogleTokens.mockResolvedValue(false);

    const res = await GET(new NextRequest(`https://backstage.localhost${RANGE}`));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ linked: false, events: [] });
    expect(mockFetchEvents).not.toHaveBeenCalled();
  });

  it("lit l'agenda et marque la reponse comme liee quand un jeton existe", async () => {
    mockHasGoogleTokens.mockResolvedValue(true);
    mockFetchEvents.mockResolvedValue([]);

    const res = await GET(new NextRequest(`https://backstage.localhost${RANGE}`));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ linked: true, events: [] });
  });
});
