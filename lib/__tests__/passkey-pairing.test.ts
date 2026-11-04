import { describe, it, expect, beforeEach, vi } from "vitest";

// Appairage d'une passkey sur un second appareil : on vérifie les propriétés de
// sécurité du code (usage unique, expiration, format), parce qu'un relâchement
// ici laisserait un appareil inconnu s'enregistrer comme propriétaire.
const store = new Map<string, unknown>();

type AnyData = Record<string, unknown>;

const CODES_FILE = "passkey-pair-codes.json";

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

const { createPasskeyPairCode, isValidPasskeyPairCode, consumePasskeyPairCode } = await import(
  "@/lib/passkey-pairing"
);

function storedCodes(): { code: string; expiresAt: string }[] {
  return ((store.get(CODES_FILE) as { codes?: { code: string; expiresAt: string }[] })?.codes ??
    []) as { code: string; expiresAt: string }[];
}

describe("passkey-pairing — code d'appairage", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("génère un code lisible de 10 caractères", async () => {
    const { code, expiresAt } = await createPasskeyPairCode();

    expect(code).toHaveLength(10);
    expect(code).toMatch(/^[a-hjkmnp-z2-9]+$/);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("un code frais est valide sans être consommé", async () => {
    const { code } = await createPasskeyPairCode();

    expect(await isValidPasskeyPairCode(code)).toBe(true);
    expect(await isValidPasskeyPairCode(code)).toBe(true);
    expect(storedCodes()).toHaveLength(1);
  });

  it("ne sert qu'une fois", async () => {
    const { code } = await createPasskeyPairCode();

    expect(await consumePasskeyPairCode(code)).toBe(true);
    expect(await isValidPasskeyPairCode(code)).toBe(false);
    expect(await consumePasskeyPairCode(code)).toBe(false);
    expect(storedCodes()).toHaveLength(0);
  });

  it("accepte un code recopié avec majuscules et espaces", async () => {
    const { code } = await createPasskeyPairCode();

    expect(await isValidPasskeyPairCode(`  ${code.toUpperCase()} `)).toBe(true);
  });

  it("refuse un code expiré", async () => {
    const { code } = await createPasskeyPairCode();
    store.set(CODES_FILE, {
      codes: [{ code, createdAt: new Date(0).toISOString(), expiresAt: new Date(1).toISOString() }],
    });

    expect(await isValidPasskeyPairCode(code)).toBe(false);
    expect(await consumePasskeyPairCode(code)).toBe(false);
  });

  it("refuse un code inconnu ou vide", async () => {
    await createPasskeyPairCode();

    expect(await isValidPasskeyPairCode("zzzzzzzzzz")).toBe(false);
    expect(await isValidPasskeyPairCode("")).toBe(false);
    expect(await consumePasskeyPairCode("")).toBe(false);
  });

  it("ne garde pas plus de 5 codes en attente", async () => {
    for (let i = 0; i < 7; i++) {
      await createPasskeyPairCode();
    }

    expect(storedCodes()).toHaveLength(5);
  });
});
