import { describe, it, expect, beforeEach, vi } from "vitest";

import { AppError } from "@/lib/errors";

const mockRequireSession = vi.fn();
vi.mock("@/lib/session", () => ({ requireSession: mockRequireSession }));

const mockAddSubscription = vi.fn();
const mockRemoveSubscription = vi.fn();
const mockGetSubscriptions = vi.fn();
vi.mock("@/lib/push-subscriptions", () => ({
  addSubscription: mockAddSubscription,
  removeSubscription: mockRemoveSubscription,
  getSubscriptions: mockGetSubscriptions,
}));

vi.mock("@/lib/send-push", () => ({
  configureVapid: vi.fn(),
  sendPushNotification: vi.fn(),
}));

const { POST } = await import("@/app/api/push/route");

const validSub = {
  endpoint: "https://push.example.com/1",
  expirationTime: null,
  keys: { p256dh: "key1", auth: "auth1" },
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddSubscription.mockResolvedValue(undefined);
  });

  it("refuse une souscription sans session", async () => {
    mockRequireSession.mockRejectedValue(new AppError("unauthenticated", "Non authentifié"));

    const res = await POST(makeRequest(validSub));

    expect(res.status).toBe(401);
    expect(mockAddSubscription).not.toHaveBeenCalled();
  });

  it("enregistre une souscription valide avec une session", async () => {
    mockRequireSession.mockResolvedValue({ userId: "owner" });

    const res = await POST(makeRequest(validSub));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockAddSubscription).toHaveBeenCalledWith(validSub);
  });

  it("refuse un payload incomplet", async () => {
    mockRequireSession.mockResolvedValue({ userId: "owner" });

    const res = await POST(makeRequest({ endpoint: "https://push.example.com/1" }));

    expect(res.status).toBe(400);
    expect(mockAddSubscription).not.toHaveBeenCalled();
  });
});
