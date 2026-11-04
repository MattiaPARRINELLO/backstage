import { describe, it, expect, beforeEach, vi } from "vitest";

// Appairage des notifications natives : on vérifie surtout les propriétés de
// sécurité (code à usage unique, expiration, secret jamais stocké en clair),
// parce qu'un relâchement ici ouvrirait les notifications privées à un autre
// appareil.
const store = new Map<string, unknown>();

type AnyData = Record<string, unknown>;

vi.mock("@/lib/storage", () => ({
  readJsonSafe: vi.fn(async (file: string, fallback: unknown) =>
    structuredClone(store.get(file) ?? fallback)
  ),
  writeJsonAtomic: vi.fn(),
}));

vi.mock("@/lib/storage-core", () => ({
  mutateJson: vi.fn(
    async (file: string, fallback: AnyData, mutator: (data: AnyData) => AnyData | null | void) => {
      const current = structuredClone(store.get(file) ?? fallback) as AnyData;
      const res = mutator(current);
      const next = res ?? current;
      store.set(file, next);
      return next;
    }
  ),
}));

const { createPairCode, redeemPairCode, authenticateDevice, listDevices, removeDevice } =
  await import("@/lib/fcm-devices");

const TOKEN = "fcm-token-de-test-0123456789";

describe("fcm-devices — appairage", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("un code frais appaire l'appareil et renvoie un secret", async () => {
    const { code } = await createPairCode();
    const result = await redeemPairCode(code, TOKEN);

    expect(result?.secret).toBeTruthy();
    const devices = await listDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0].token).toBe(TOKEN);
  });

  it("ne stocke jamais le secret en clair", async () => {
    const { code } = await createPairCode();
    const { secret } = (await redeemPairCode(code, TOKEN))!;

    const stored = store.get("fcm-devices.json") as {
      devices: { secretHash: string }[];
    };
    expect(stored.devices[0].secretHash).not.toBe(secret);
    expect(JSON.stringify(stored)).not.toContain(secret);
  });

  it("le code est consommé : un second essai échoue", async () => {
    const { code } = await createPairCode();
    expect(await redeemPairCode(code, TOKEN)).not.toBeNull();
    expect(await redeemPairCode(code, "autre-token-0123456789")).toBeNull();
  });

  it("un code expiré est refusé", async () => {
    const { code, expiresAt } = await createPairCode();
    const codes = store.get("fcm-pair-codes.json") as {
      codes: { code: string; expiresAt: string }[];
    };
    codes.codes = codes.codes.map((c) => ({ ...c, expiresAt: "2000-01-01T00:00:00.000Z" }));
    store.set("fcm-pair-codes.json", codes);

    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(await redeemPairCode(code, TOKEN)).toBeNull();
  });

  it("accepte le code en majuscules et avec espaces", async () => {
    const { code } = await createPairCode();
    expect(await redeemPairCode(`  ${code.toUpperCase()} `, TOKEN)).not.toBeNull();
  });

  it("authentifie un appareil avec le bon secret, refuse le mauvais", async () => {
    const { code } = await createPairCode();
    const { secret } = (await redeemPairCode(code, TOKEN))!;

    expect(await authenticateDevice(TOKEN, secret)).toBe(true);
    expect(await authenticateDevice(TOKEN, "mauvais-secret")).toBe(false);
    expect(await authenticateDevice("inconnu", secret)).toBe(false);
  });

  it("retirer un appareil le supprime", async () => {
    const { code } = await createPairCode();
    await redeemPairCode(code, TOKEN);
    await removeDevice(TOKEN);
    expect(await listDevices()).toEqual([]);
  });
});
