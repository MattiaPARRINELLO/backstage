import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Le token bucket vit dans un Map au niveau du module : chaque test recharge
// une instance neuve pour ne pas hériter des compteurs du précédent.
async function loadRateLimit() {
  vi.resetModules();
  return import("../rate-limit");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllTimers();
});

describe("checkRateLimit", () => {
  it("autorise 30 appels sur une fenetre de 60 s puis refuse", async () => {
    const { checkRateLimit } = await loadRateLimit();

    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit("session-a"), `appel ${i + 1}`).toBe(true);
    }
    expect(checkRateLimit("session-a")).toBe(false);
  });

  it("recharge le quota proportionnellement au temps ecoule", async () => {
    const { checkRateLimit } = await loadRateLimit();

    for (let i = 0; i < 30; i++) checkRateLimit("session-a");
    expect(checkRateLimit("session-a")).toBe(false);

    // 30 s = une demi-fenetre = floor(30/60 * 30) = 15 jetons.
    vi.advanceTimersByTime(30_000);
    for (let i = 0; i < 15; i++) {
      expect(checkRateLimit("session-a"), `jeton ${i + 1}`).toBe(true);
    }
    expect(checkRateLimit("session-a")).toBe(false);
  });

  it("recharge progressivement sans arrondir au-dessus du reel", async () => {
    const { checkRateLimit } = await loadRateLimit();

    for (let i = 0; i < 30; i++) checkRateLimit("session-a");

    // 2 s = floor(2/60 * 30) = 1 jeton, pas plus.
    vi.advanceTimersByTime(2_000);
    expect(checkRateLimit("session-a")).toBe(true);
    expect(checkRateLimit("session-a")).toBe(false);
  });

  it("ne depasse jamais le maximum apres une longue attente", async () => {
    const { checkRateLimit } = await loadRateLimit();

    for (let i = 0; i < 30; i++) checkRateLimit("session-a");
    vi.advanceTimersByTime(10 * 60_000);

    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit("session-a"), `jeton ${i + 1}`).toBe(true);
    }
    expect(checkRateLimit("session-a")).toBe(false);
  });

  it("isole les buckets de deux cles differentes", async () => {
    const { checkRateLimit } = await loadRateLimit();

    for (let i = 0; i < 30; i++) checkRateLimit("session-a");
    expect(checkRateLimit("session-a")).toBe(false);

    expect(checkRateLimit("session-b")).toBe(true);
  });

  it("respecte un maximum personnalise", async () => {
    const { checkRateLimit } = await loadRateLimit();

    expect(checkRateLimit("cle", 2, 1_000)).toBe(true);
    expect(checkRateLimit("cle", 2, 1_000)).toBe(true);
    expect(checkRateLimit("cle", 2, 1_000)).toBe(false);

    // 500 ms = floor(0.5 * 2) = 1 jeton.
    vi.advanceTimersByTime(500);
    expect(checkRateLimit("cle", 2, 1_000)).toBe(true);
    expect(checkRateLimit("cle", 2, 1_000)).toBe(false);
  });

  it("ne purge pas un bucket actif lors du tick periodique", async () => {
    const { checkRateLimit } = await loadRateLimit();

    for (let i = 0; i < 30; i++) checkRateLimit("actif");
    expect(checkRateLimit("actif")).toBe(false);

    // Fait tourner la purge (toutes les 60 s) : le bucket vient d'etre
    // utilise, il doit survivre et se recharger completement.
    vi.advanceTimersByTime(60_000);
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit("actif"), `jeton ${i + 1}`).toBe(true);
    }
    expect(checkRateLimit("actif")).toBe(false);
  });

  it("conserve un bucket inactif jusqu'a deux fenetres", async () => {
    const { checkRateLimit } = await loadRateLimit();

    expect(checkRateLimit("ancienne")).toBe(true);

    // Deux ticks de purge passent, le second voit exactement 120 s
    // d'inactivite : la condition est strictement superieure, le bucket
    // survit et se recharge a plein.
    vi.advanceTimersByTime(120_000);
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit("ancienne"), `jeton ${i + 1}`).toBe(true);
    }
  });
});
