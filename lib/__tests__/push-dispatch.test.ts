import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// L'envoi push est le seul endroit qui parle aux deux canaux (web push pour la
// PWA, FCM pour l'APK). Ces tests figent la traduction du JSON et le comptage
// des appareils, sans reseau.

const fcmCalls: unknown[] = [];
const sendPushNotification = vi.fn(async (..._args: unknown[]) => {});
const removeSubscription = vi.fn(async (_endpoint: string) => {});
const serverLog = vi.fn((..._args: unknown[]) => {});
let subscriptions: { endpoint: string; keys: { p256dh: string; auth: string } }[] = [];
let vapid: { publicKey: string; privateKey: string } = { publicKey: "pub", privateKey: "priv" };
let nativeResult = { sent: true, devices: 1 };

vi.mock("@/lib/fcm", () => ({
  sendFcmToAll: vi.fn(async (payload: unknown) => {
    fcmCalls.push(payload);
    return nativeResult;
  }),
}));

vi.mock("@/lib/push-subscriptions", () => ({
  getSubscriptions: vi.fn(async () => subscriptions),
  removeSubscription: (endpoint: string) => removeSubscription(endpoint),
}));

vi.mock("@/lib/send-push", () => ({
  configureVapid: vi.fn(() => vapid),
  sendPushNotification: (...args: unknown[]) => sendPushNotification(...args),
}));

vi.mock("@/lib/logger", () => ({
  serverLog: (...args: unknown[]) => serverLog(...args),
}));

const { sendPushToAll } = await import("@/lib/push-dispatch");

function sub(endpoint: string) {
  return { endpoint, keys: { p256dh: "p", auth: "a" } };
}

describe("sendPushToAll", () => {
  beforeEach(() => {
    fcmCalls.length = 0;
    subscriptions = [];
    vapid = { publicKey: "pub", privateKey: "priv" };
    nativeResult = { sent: true, devices: 1 };
    sendPushNotification.mockReset();
    sendPushNotification.mockResolvedValue(undefined);
    removeSubscription.mockReset();
    serverLog.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("traduit le JSON web push en message FCM", async () => {
    await sendPushToAll(
      JSON.stringify({
        title: "Rappel",
        body: "Acheter du pain",
        tag: "reminder-r1",
        promoted: true,
        criticalText: "14:00",
        progress: 12,
        progressMax: 60,
        dismiss: true,
        data: { type: "reminder", url: "/reminders" },
      })
    );

    expect(fcmCalls[0]).toEqual({
      title: "Rappel",
      body: "Acheter du pain",
      tag: "reminder-r1",
      type: "reminder",
      url: "/reminders",
      promoted: true,
      criticalText: "14:00",
      progress: 12,
      progressMax: 60,
      dismiss: true,
    });
  });

  it("retombe sur un corps brut quand le JSON est invalide", async () => {
    await sendPushToAll("pas du json");

    expect(fcmCalls[0]).toMatchObject({
      title: "BACKSTAGE",
      body: "pas du json",
      promoted: false,
      dismiss: false,
    });
  });

  it("tronque le corps a 400 caracteres pour FCM", async () => {
    await sendPushToAll(JSON.stringify({ body: "x".repeat(500) }));

    expect((fcmCalls[0] as { body: string }).body).toHaveLength(400);
  });

  it("envoie aux deux canaux et additionne les appareils", async () => {
    subscriptions = [sub("https://push.example/1"), sub("https://push.example/2")];

    const result = await sendPushToAll(JSON.stringify({ title: "Brief" }));

    expect(sendPushNotification).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ sent: true, devices: 3 });
  });

  it("reste envoye si seul le canal natif repond", async () => {
    subscriptions = [sub("https://push.example/1")];
    nativeResult = { sent: true, devices: 1 };
    sendPushNotification.mockRejectedValue({ statusCode: 500 });

    const result = await sendPushToAll(JSON.stringify({ title: "Brief" }));

    expect(result).toEqual({ sent: true, devices: 2 });
    expect(removeSubscription).not.toHaveBeenCalled();
  });

  it("supprime une souscription invalide (410) sans faire echouer l'envoi", async () => {
    subscriptions = [sub("https://push.example/morte")];
    nativeResult = { sent: false, devices: 0 };
    sendPushNotification.mockRejectedValue({ statusCode: 410 });

    const result = await sendPushToAll(JSON.stringify({ title: "Brief" }));

    expect(removeSubscription).toHaveBeenCalledWith("https://push.example/morte");
    expect(result).toEqual({ sent: false, devices: 1 });
    expect(serverLog).toHaveBeenCalled();
  });

  it("n'envoie pas de web push sans cles VAPID, mais garde le natif", async () => {
    subscriptions = [sub("https://push.example/1")];
    vapid = { publicKey: "", privateKey: "" };

    const result = await sendPushToAll(JSON.stringify({ title: "Brief" }));

    expect(sendPushNotification).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: true, devices: 2 });
    expect(serverLog).toHaveBeenCalledWith("scheduler", "error", "VAPID keys missing");
  });

  it("ne journalise rien quand quiet est actif", async () => {
    subscriptions = [sub("https://push.example/1")];

    await sendPushToAll(JSON.stringify({ title: "Cours" }), { quiet: true });

    expect(console.log).not.toHaveBeenCalled();
  });
});
