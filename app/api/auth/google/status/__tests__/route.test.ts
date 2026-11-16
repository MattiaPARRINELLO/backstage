import { describe, it, expect, beforeEach, vi } from "vitest";

const mockRequireSession = vi.fn();
vi.mock("@/lib/session", () => ({ requireSession: mockRequireSession }));

const mockIsGoogleLinked = vi.fn();
vi.mock("@/lib/google-client", () => ({ isGoogleLinked: mockIsGoogleLinked }));

vi.mock("@/lib/server-cache", () => ({
  getServerCached: vi.fn(() => undefined),
  setServerCached: vi.fn(),
}));

const { GET } = await import("@/app/api/auth/google/status/route");

describe("GET /api/auth/google/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGoogleLinked.mockResolvedValue(false);
  });

  it("répond 401 sans session", async () => {
    mockRequireSession.mockRejectedValue(new Error("Non authentifié"));

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Non authentifié" });
    expect(mockIsGoogleLinked).not.toHaveBeenCalled();
  });

  it("conserve la forme de réponse pour un appelant authentifié", async () => {
    mockRequireSession.mockResolvedValue({ userId: "owner" });
    mockIsGoogleLinked.mockResolvedValue(true);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ gmail: true, calendar: true });
  });
});
