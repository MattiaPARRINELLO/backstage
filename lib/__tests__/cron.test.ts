import { describe, expect, it } from "vitest";

import { defineModule } from "@backstage/module-kit";

import { cronMatches, parseCron } from "@/lib/kernel/cron";
import { createRegistry } from "@/lib/kernel/registry-core";

const at = (month: number, day: number, hour: number, minute: number): Date =>
  new Date(2026, month - 1, day, hour, minute, 0, 0);

describe("cron — evaluation", () => {
  it("accepte chaque minute avec * * * * *", () => {
    for (const minute of [0, 1, 30, 59]) {
      expect(cronMatches("* * * * *", at(11, 22, 7, minute)), String(minute)).toBe(true);
    }
  });

  it("ne se declenche qu'a l'heure exacte pour 0 7 * * *", () => {
    expect(cronMatches("0 7 * * *", at(11, 22, 7, 0))).toBe(true);
    expect(cronMatches("0 7 * * *", at(11, 22, 7, 1))).toBe(false);
    expect(cronMatches("0 7 * * *", at(11, 22, 6, 0))).toBe(false);
    expect(cronMatches("0 7 * * *", at(11, 22, 8, 0))).toBe(false);
  });

  it("accepte les listes", () => {
    expect(cronMatches("5,10 * * * *", at(11, 22, 7, 5))).toBe(true);
    expect(cronMatches("5,10 * * * *", at(11, 22, 7, 10))).toBe(true);
    expect(cronMatches("5,10 * * * *", at(11, 22, 7, 7))).toBe(false);
  });

  it("accepte les plages", () => {
    expect(cronMatches("10-15 * * * *", at(11, 22, 7, 10))).toBe(true);
    expect(cronMatches("10-15 * * * *", at(11, 22, 7, 15))).toBe(true);
    expect(cronMatches("10-15 * * * *", at(11, 22, 7, 9))).toBe(false);
    expect(cronMatches("10-15 * * * *", at(11, 22, 7, 16))).toBe(false);
  });

  it("accepte les pas, seuls ou dans une plage", () => {
    expect([...parseCron("*/15 * * * *").minutes].sort((a, b) => a - b)).toEqual([
      0, 15, 30, 45,
    ]);
    expect(cronMatches("*/15 * * * *", at(11, 22, 7, 45))).toBe(true);
    expect(cronMatches("*/15 * * * *", at(11, 22, 7, 46))).toBe(false);
    expect([...parseCron("10-20/5 * * * *").minutes].sort((a, b) => a - b)).toEqual([
      10, 15, 20,
    ]);
  });

  it("combine jour du mois et jour de la semaine en OU quand les deux sont restreints", () => {
    // 1er novembre 2026 : dimanche. 23 novembre 2026 : lundi.
    expect(cronMatches("0 9 1 * 1", at(11, 1, 9, 0))).toBe(true);
    expect(cronMatches("0 9 1 * 1", at(11, 23, 9, 0))).toBe(true);
    expect(cronMatches("0 9 1 * 1", at(11, 3, 9, 0))).toBe(false);
  });

  it("traite 7 comme dimanche", () => {
    expect(cronMatches("0 9 * * 7", at(11, 22, 9, 0))).toBe(true);
    expect(cronMatches("0 9 * * 0", at(11, 22, 9, 0))).toBe(true);
    expect(cronMatches("0 9 * * 1", at(11, 22, 9, 0))).toBe(false);
  });

  it("evalue dans le fuseau local du serveur", () => {
    const date = at(11, 22, 7, 0);
    expect(date.getHours()).toBe(7);
    expect(cronMatches("0 7 * * *", date)).toBe(true);
    expect(cronMatches("0 8 * * *", date)).toBe(false);
  });

  it("refuse les bornes invalides et les plages inversees", () => {
    for (const expression of [
      "60 * * * *",
      "0 24 * * *",
      "0 0 32 * *",
      "0 0 * 13 *",
      "0 0 * * 8",
      "*/0 * * * *",
      "5-1 * * * *",
      "0 7 * *",
    ]) {
      expect(() => parseCron(expression), expression).toThrow();
    }
  });

  it("refuse une expression invalide au chargement du registre", () => {
    const definition = defineModule({
      id: "bad",
      apiVersion: 1,
      version: "1.0.0",
      label: "Bad",
      selectionDescription: "Bad",
      description: "Bad",
      jobs: [{ id: "bad", cron: "60 * * * *", handler: async () => {} }],
    });

    expect(() => createRegistry([definition])).toThrow(/expression cron invalide/);
  });
});
