import { describe, it, expect } from "vitest";
import { briefFields, buildEmbed, toDiscordMarkdown, truncate } from "@/lib/discord/embed";
import { digestFromBrief, extractFocus } from "@/lib/discord/digest";
import type { DailyBrief } from "@/lib/types";

const digest = {
  date: "2026-10-01",
  focus: "Rendre le rapport avant 18h",
  weather: "12 °C, ciel couvert",
  courses: [{ title: "Analyse numérique", time: "10:15", location: "Amphi B" }],
  reminders: ["Appeler le CROUS"],
  agenda: ["18:00 — Point équipe"],
  urgentEmails: ["Relance facture"],
  unreadCount: 12,
  leetcode: "2 exercices",
};

describe("toDiscordMarkdown", () => {
  it("convertit les titres markdown en gras (Discord ne rend pas les #)", () => {
    expect(toDiscordMarkdown("## Ma journée")).toBe("**Ma journée**");
  });

  it("remplace les puces par un point médian", () => {
    expect(toDiscordMarkdown("- un\n- deux")).toBe("• un\n• deux");
  });

  it("aplatit les tableaux markdown en lignes", () => {
    const table = "| Heure | Cours |\n| --- | --- |\n| 10:15 | Maths |";
    expect(toDiscordMarkdown(table)).toBe("Heure · Cours\n10:15 · Maths");
  });

  it("réduit les suites de sauts de ligne", () => {
    expect(toDiscordMarkdown("un\n\n\n\ndeux")).toBe("un\n\ndeux");
  });
});

describe("truncate", () => {
  it("laisse intact un texte plus court que la limite", () => {
    expect(truncate("court", 10)).toBe("court");
  });

  it("tronque avec une ellipse sans dépasser la limite", () => {
    const out = truncate("a".repeat(50), 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("buildEmbed", () => {
  it("expose le brief du jour avec ses champs structurés", () => {
    const embed = buildEmbed({ kind: "daily-brief", summary: "## Titre\n- un", digest });
    expect(embed.author?.name).toContain("Brief du");
    expect(embed.title).toBe("Météo : 12 °C, ciel couvert");
    expect(embed.description).toBe("**Titre**\n• un");
    expect(embed.fields?.map((f) => f.name)).toContain("Cours");
    expect(embed.footer?.text).toContain("brief du jour");
  });

  it("décrit un cours avec horaire, salle et enseignant", () => {
    const embed = buildEmbed({
      kind: "course",
      leadMin: 30,
      course: {
        uuid: "u1",
        subject: "Analyse numérique",
        teacher: "M. Dupont",
        room: "Amphi B",
        start: new Date("2026-10-01T08:15:00Z").getTime(),
        end: new Date("2026-10-01T10:15:00Z").getTime(),
        lessonType: "Cours magistral",
        cancelled: false,
        remote: false,
        description: "",
        group: "G1",
      },
    });
    expect(embed.author?.name).toBe("BACKSTAGE · Dans 30 min");
    expect(embed.fields?.map((f) => f.name)).toEqual(["Horaire", "Salle", "Enseignant"]);
  });

  it("borne le titre et les valeurs de champs aux limites Discord", () => {
    const embed = buildEmbed({
      kind: "reminder",
      reminder: {
        id: "r1",
        title: "T".repeat(400),
        notes: "N".repeat(5000),
        dueAt: new Date().toISOString(),
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    });
    expect((embed.title ?? "").length).toBeLessThanOrEqual(256);
    expect((embed.description ?? "").length).toBeLessThanOrEqual(4096);
  });

  it("produit un embed d'alerte en couleur danger", () => {
    const embed = buildEmbed({
      kind: "alert",
      module: "scheduler",
      message: "Push échoué",
      detail: "410 Gone",
      level: "error",
    });
    expect(embed.color).toBe(0xf38ba8);
    expect(embed.description).toContain("410 Gone");
  });

  it("n'ajoute aucun champ vide", () => {
    const embed = buildEmbed({
      kind: "daily-brief",
      summary: "rien",
      digest: { ...digest, courses: [], reminders: [], agenda: [], leetcode: null },
    });
    const names = embed.fields?.map((f) => f.name) ?? [];
    expect(names).not.toContain("Cours");
    expect(names).not.toContain("Rappels");
    expect(names).toContain("Boîte mail");
  });
});

describe("briefFields", () => {
  it("plafonne les listes pour rester lisible", () => {
    const fields = briefFields({
      ...digest,
      courses: Array.from({ length: 12 }, (_, i) => ({ title: `Cours ${i}`, time: "10:00" })),
      reminders: Array.from({ length: 20 }, (_, i) => `Rappel ${i}`),
    });
    const cours = fields.find((f) => f.name === "Cours");
    expect(cours?.value.split("\n")).toHaveLength(4);
    const rappels = fields.find((f) => f.name === "Rappels");
    expect(rappels?.value.split("\n")).toHaveLength(6);
  });
});

describe("extractFocus", () => {
  it("retient la première ligne porteuse de contenu, sans markdown", () => {
    expect(extractFocus("## Ma journée\n- premier point")).toBe("Ma journée");
  });

  it("ignore une ligne trop courte", () => {
    expect(extractFocus("#\n\nUn vrai contenu")).toBe("Un vrai contenu");
  });

  it("retourne undefined sur un brief vide", () => {
    expect(extractFocus("")).toBeUndefined();
  });

  it("tronque proprement une phrase trop longue", () => {
    const out = extractFocus(`Phrase ${"très ".repeat(40)}longue`);
    expect(out?.length).toBeLessThanOrEqual(96);
  });
});

describe("digestFromBrief", () => {
  const brief: DailyBrief = {
    date: "2026-10-01",
    summary: "## Titre\n- détail",
    events: [
      { title: "Analyse numérique", type: "course", time: "10:15", location: "Amphi B" },
      { title: "Point équipe", type: "event", time: "18:00" },
      { title: "Concert au Trabendo", type: "concert" },
    ],
    reminders: [{ title: "Appeler le CROUS", dueAt: "2026-10-01T09:00:00.000Z" }],
    emails: [
      { from: "a@b.c", subject: "m1" },
      { from: "d@e.f", subject: "m2" },
    ],
    urgentEmails: [{ from: "a@b.c", subject: "Relance facture" }],
    leetcodeDaily: { title: "Two Sum", difficulty: "Easy" },
    weather: "12 °C",
    generatedAt: "2026-10-01T07:00:00.000Z",
  };

  it("sépare cours et agenda sans requête supplémentaire", () => {
    const out = digestFromBrief(brief, brief.summary);
    expect(out.courses).toEqual([{ title: "Analyse numérique", time: "10:15", location: "Amphi B" }]);
    expect(out.agenda).toEqual(["18:00 — Point équipe", "Concert au Trabendo"]);
    expect(out.unreadCount).toBe(2);
    expect(out.urgentEmails).toEqual(["Relance facture"]);
    expect(out.leetcode).toBe("Two Sum (Easy)");
    expect(out.focus).toBe("Titre");
  });

  it("tolère un brief sans emails urgents ni LeetCode", () => {
    const out = digestFromBrief({ ...brief, urgentEmails: undefined, leetcodeDaily: undefined }, "");
    expect(out.urgentEmails).toEqual([]);
    expect(out.leetcode).toBeNull();
    expect(out.focus).toBeUndefined();
  });
});
